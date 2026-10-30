import hashlib
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.engine.scoring import CONTROLS
from app.ingest import RateLimiter, get_db
from app.main import app
from app.tprm import service
from app.tprm.scoring import chain_score, tprm_score

ALL = list(CONTROLS)
YES = {c: "sim" for c in ALL}
NO = {c: "nao" for c in ALL}


# ---------------------------------------------------------------- nota TPRM (pura)
def test_full_marks_with_proof_and_clean_external_is_100():
    r = tprm_score(YES, 100, set(ALL))
    assert r["score"] == 100 and r["answers_score"] == 100 and r["status"] == "homologado" and r["unproven"] == []


def test_declared_without_proof_counts_less():
    r = tprm_score(YES, 100, set())
    assert r["answers_score"] == 70
    assert sorted(r["unproven"]) == sorted(ALL)
    assert r["score"] == round(0.6 * 70 + 0.4 * 100)  # 82


def test_all_no_is_zero_and_rejected():
    r = tprm_score(NO, 0, set())
    assert r["score"] == 0 and r["status"] == "reprovado"


def test_weights_60_answers_40_external():
    assert tprm_score(YES, 50, set(ALL))["score"] == 80


def test_without_external_uses_answers_only_and_says_so():
    r = tprm_score(YES, None, set(ALL))
    assert r["score"] == 100 and r["external_score"] is None and r["external_missing"] is True


def test_dont_know_is_zero():
    r = tprm_score({c: "nao_sei" for c in ALL}, 100, set())
    assert r["answers_score"] == 0 and r["score"] == 40


def test_high_score_with_failed_essential_control_is_not_homologated():
    answers = dict(YES, C03="nao")
    r = tprm_score(answers, 100, set(ALL))
    assert r["score"] >= 70 and r["status"] == "concluido"


def test_middle_band_is_concluded_not_rejected():
    r = tprm_score({**NO, **{c: "sim" for c in ALL[:7]}}, 60, set(ALL))
    assert 50 <= r["score"] < 70 and r["status"] == "concluido"


def test_unknown_answers_are_ignored():
    r = tprm_score({**YES, "C99": "sim", "C01": "talvez"}, 100, set(ALL))
    assert r["answers_score"] < 100


def test_chain_score_is_weighted_by_criticality():
    vendors = [{"tprm_score": 90, "criticality": "baixa"}, {"tprm_score": 30, "criticality": "alta"}]
    assert chain_score(vendors) == round((90 * 1 + 30 * 3) / 4)  # 45
    assert chain_score([{"tprm_score": None, "criticality": "alta"}]) is None
    assert chain_score([]) is None
    assert chain_score([{"tprm_score": 80, "criticality": "xx"}]) == 80


# ---------------------------------------------------------------- serviço
class FakeDb:
    def __init__(self):
        self.pending = [
            {"id": "a1", "org_id": "o1", "vendor_id": "v1", "domain": "fornecedor.com.br", "answers": dict(YES), "vendor_name": "Fornecedor"}
        ]
        self.due = []
        self.evidence = {"a1": set(ALL)}
        self.results, self.alerts = [], []

    def pending_vendor_assessments(self, limit=20):
        return self.pending

    def vendor_evidence_controls(self, assessment_id):
        return self.evidence.get(assessment_id, set())

    def save_vendor_result(self, **kw):
        self.results.append(kw)

    def vendors_due(self, days):
        self.last_days = days
        return self.due

    def insert_alert(self, org_id, control_id, severity, message):
        self.alerts.append((org_id, severity, message))


def scan_ok(domain):
    return {"X01": "ok", "X02": "ok", "X03": "ok", "X04": "ok", "X05": "ok", "X06": "ok"}


def test_process_submitted_scores_and_saves():
    db = FakeDb()
    assert service.process_submitted(db, scan=scan_ok) == 1
    r = db.results[0]
    assert (r["assessment_id"], r["vendor_id"], r["tprm_score"], r["status"]) == ("a1", "v1", 100, "homologado")
    assert r["external_score"] == 100 and r["answers_score"] == 100


def test_process_submitted_survives_scan_failure():
    db = FakeDb()

    def boom(domain):
        raise RuntimeError("dns")

    assert service.process_submitted(db, scan=boom) == 1
    assert db.results[0]["external_score"] is None and db.results[0]["tprm_score"] == 100


def test_process_submitted_skips_invalid_domain_scan():
    db = FakeDb()
    db.pending[0]["domain"] = "http://x/../etc"
    calls = []
    assert service.process_submitted(db, scan=lambda d: calls.append(d) or {}) == 1
    assert calls == [] and db.results[0]["external_score"] is None


def test_reassess_downgrade_raises_alert_and_upgrade_does_not():
    db = FakeDb()
    db.due = [
        {"vendor_id": "v1", "org_id": "o1", "assessment_id": "a1", "domain": "f.com.br", "answers": dict(YES), "status": "homologado", "vendor_name": "Fornecedor"},
        {"vendor_id": "v2", "org_id": "o1", "assessment_id": "a2", "domain": "g.com.br", "answers": dict(YES), "status": "reprovado", "vendor_name": "Outro"},
    ]
    db.evidence = {"a1": set(ALL), "a2": set(ALL)}
    bad = {"X01": "falha", "X02": "falha", "X03": "falha", "X04": "falha", "X05": "falha", "X06": "falha"}
    out = service.reassess_due(db, days=90, scan=lambda d: bad if d == "f.com.br" else scan_ok(d))
    assert out == {"reavaliados": 2, "rebaixados": 1}
    assert db.last_days == 90
    assert len(db.alerts) == 1 and "Fornecedor" in db.alerts[0][2] and db.alerts[0][1] == "atencao"
    by = {r["vendor_id"]: r for r in db.results}
    assert by["v1"]["status"] == "concluido" and by["v2"]["status"] == "homologado"


# ---------------------------------------------------------------- endpoints
TOKEN = "vnd_" + "c" * 64
HASH = hashlib.sha256(TOKEN.encode()).hexdigest()
PDF = b"%PDF-1.4\n" + b"x" * 100


class ApiDb:
    def __init__(self):
        far = (datetime.now(UTC) + timedelta(days=5)).isoformat()
        self.assessment = {"id": "a1", "org_id": "11111111-1111-1111-1111-111111111111", "vendor_id": "v1", "status": "pendente", "token_expires_at": far, "revoked_at": None}
        self.count, self.uploads, self.rows, self.lookups = 0, [], [], []

    def find_vendor_assessment(self, token_hash):
        self.lookups.append(token_hash)
        return self.assessment if token_hash == HASH else None

    def count_vendor_evidence(self, assessment_id):
        return self.count

    def upload_vendor_evidence(self, path, data, content_type):
        self.uploads.append((path, data, content_type))

    def save_vendor_evidence_row(self, **kw):
        self.rows.append(kw)


@pytest.fixture
def api():
    db = ApiDb()
    app.dependency_overrides[get_db] = lambda: db
    import app.tprm.api as tprm_api

    tprm_api.limiter = RateLimiter(max_events=20, window_seconds=3600)
    tprm_api.auth_failures = RateLimiter(max_events=tprm_api.AUTH_FAILURES_PER_WINDOW, window_seconds=600)
    yield TestClient(app), db
    app.dependency_overrides.clear()


def upload(c, body=PDF, token=TOKEN, control="C03", name="backup.pdf"):
    return c.post(f"/tprm/vendor/{token}/evidence", params={"control": control}, content=body, headers={"X-File-Name": name})


def test_upload_stores_file_with_hash_and_safe_path(api):
    c, db = api
    r = upload(c)
    assert r.status_code == 201 and r.json()["sha256"] == hashlib.sha256(PDF).hexdigest()
    path, data, mime = db.uploads[0]
    assert path.startswith("11111111-1111-1111-1111-111111111111/vendors/a1/C03-") and path.endswith(".pdf")
    assert data == PDF and mime == "application/pdf"
    row = db.rows[0]
    assert row["file_hash_sha256"] == hashlib.sha256(PDF).hexdigest() and row["control_id"] == "C03" and row["file_name"] == "backup.pdf"
    assert db.lookups == [HASH]


def test_upload_rejects_non_document_and_bad_control(api):
    c, db = api
    assert upload(c, body=b"MZ\x90\x00 executavel").status_code == 415
    assert upload(c, control="X99").status_code == 400
    assert db.uploads == []


def test_upload_rejects_big_body(api):
    c, db = api
    assert upload(c, body=b"%PDF-" + b"0" * (10 * 1024 * 1024 + 1)).status_code == 413
    assert db.uploads == []


def test_upload_invalid_expired_revoked_or_used_token_gets_same_404(api):
    c, db = api
    assert upload(c, token="vnd_" + "d" * 64).status_code == 404
    assert upload(c, token="lixo").status_code == 404
    db.assessment["revoked_at"] = datetime.now(UTC).isoformat()
    assert upload(c).status_code == 404
    db.assessment["revoked_at"] = None
    db.assessment["token_expires_at"] = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    assert upload(c).status_code == 404
    db.assessment["token_expires_at"] = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    db.assessment["status"] = "enviada"
    assert upload(c).status_code == 404
    assert db.uploads == []


def test_upload_limit_per_assessment(api):
    c, db = api
    db.count = 20
    assert upload(c).status_code == 429


def test_reassess_endpoint_needs_the_cron_token(api, monkeypatch):
    c, _ = api
    monkeypatch.delenv("TPRM_CRON_TOKEN", raising=False)
    assert c.post("/tprm/reassess").status_code == 503
    monkeypatch.setenv("TPRM_CRON_TOKEN", "segredo-longo-de-teste-1234567890")
    assert c.post("/tprm/reassess").status_code == 401
    assert c.post("/tprm/reassess", headers={"Authorization": "Bearer errado"}).status_code == 401

    import app.tprm.api as tprm_api

    monkeypatch.setattr(tprm_api.service, "reassess_due", lambda db, days: {"reavaliados": 3, "rebaixados": 1})
    monkeypatch.setattr(tprm_api.service, "process_submitted", lambda db: 2)
    r = c.post("/tprm/reassess", headers={"Authorization": "Bearer segredo-longo-de-teste-1234567890"})
    assert r.status_code == 200 and r.json() == {"reavaliados": 3, "rebaixados": 1, "processadas": 2}
