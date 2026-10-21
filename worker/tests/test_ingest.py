import hashlib
import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.ingest import RateLimiter, get_db
from app.main import app

TOKEN = "snt_" + "a" * 64
HASH = hashlib.sha256(TOKEN.encode()).hexdigest()


class FakeDb:
    def __init__(self, token=None):
        far = (datetime.now(UTC) + timedelta(days=100)).isoformat()
        self.token = token if token is not None else {"id": "t1", "org_id": "o1", "expires_at": far, "revoked_at": None}
        self.lookups, self.saved, self.touched, self.enqueued = [], [], [], []

    def find_agent_token(self, token_hash):
        self.lookups.append(token_hash)
        return self.token

    def save_agent_result(self, **kw):
        self.saved.append(kw)

    def touch_agent_token(self, token_id):
        self.touched.append(token_id)

    def enqueue_completo(self, org_id):
        self.enqueued.append(org_id)


@pytest.fixture
def client():
    db = FakeDb()
    app.dependency_overrides[get_db] = lambda: db
    import app.ingest as ingest

    ingest.limiter = RateLimiter(max_events=10, window_seconds=3600)
    ingest.auth_failures = RateLimiter(max_events=ingest.AUTH_FAILURES_PER_WINDOW, window_seconds=600)
    yield TestClient(app), db
    app.dependency_overrides.clear()


def windows_body(**machine):
    m = dict(os_supported=True, last_update_days=10, av_active=True, av_age_days=1, user_is_local_admin=False, is_laptop=True, bitlocker=None)
    m.update(machine)
    return {"module": "windows", "collector_version": "1.0.0", "collected_at": datetime.now(UTC).isoformat(), "device_ref": "b" * 64, "summary": {"machine": m}}


def post(c, body, token=TOKEN, raw=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return c.post("/ingest", content=raw if raw is not None else json.dumps(body), headers={**headers, "Content-Type": "application/json"})


def test_valid_windows_payload_is_stored_hashed_and_triggers_processing(client):
    c, db = client
    r = post(c, windows_body())
    assert r.status_code == 202
    saved = db.saved[0]
    assert saved["org_id"] == "o1" and saved["module"] == "windows" and saved["device_ref"] == "b" * 64
    assert len(saved["sha256"]) == 64 and saved["summary"]["machine"]["av_active"] is True
    assert db.lookups == [HASH]  # only the hash of the token is ever looked up
    assert db.touched == ["t1"] and db.enqueued == ["o1"]


def test_valid_m365_payload(client):
    c, db = client
    body = {"module": "m365", "collector_version": "1.0.0", "collected_at": datetime.now(UTC).isoformat(), "summary": {"users_total": 20, "users_with_mfa": 18, "admins_global": 3, "admins_without_mfa": 0}}
    assert post(c, body).status_code == 202
    assert db.saved[0]["module"] == "m365" and db.saved[0]["device_ref"] is None


# ---------------------------------------------------------------- token
def test_missing_or_malformed_token_is_refused_without_touching_the_database(client):
    c, db = client
    for token in (None, "x", "snt_short", "Bearer snt_" + "a" * 64):
        assert post(c, windows_body(), token=token).status_code == 401
    assert db.lookups == []


def test_unknown_revoked_and_expired_tokens_are_refused(client):
    c, db = client
    db.token = None
    assert post(c, windows_body()).status_code == 401
    db.token = {"id": "t1", "org_id": "o1", "expires_at": (datetime.now(UTC) + timedelta(days=5)).isoformat(), "revoked_at": datetime.now(UTC).isoformat()}
    assert post(c, windows_body()).status_code == 401
    db.token = {"id": "t1", "org_id": "o1", "expires_at": (datetime.now(UTC) - timedelta(days=1)).isoformat(), "revoked_at": None}
    assert post(c, windows_body()).status_code == 401
    assert db.saved == []


# ---------------------------------------------------------------- validação: nada de dado pessoal
def test_a_list_of_people_is_rejected(client):
    c, db = client
    body = windows_body()
    body["summary"]["machine"]["users"] = ["ana@empresa.com.br", "joao@empresa.com.br"]
    assert post(c, body).status_code == 422
    body = windows_body()
    body["hostname"] = "PC-FINANCEIRO"
    assert post(c, body).status_code == 422
    body = windows_body()
    body["summary"]["emails"] = ["ana@empresa.com.br"]
    assert post(c, body).status_code == 422
    assert db.saved == []


def test_error_does_not_echo_the_submitted_values(client):
    c, _ = client
    body = windows_body()
    body["summary"]["machine"]["users"] = ["ana@empresa.com.br"]
    assert "ana@empresa.com.br" not in post(c, body).text


@pytest.mark.parametrize(
    "patch",
    [
        {"module": "linux"},
        {"collector_version": "1.0; drop table"},
        {"device_ref": "PC-FINANCEIRO"},
        {"device_ref": None},  # windows precisa do hash da máquina
    ],
)
def test_bad_envelope_fields_are_rejected(client, patch):
    c, db = client
    body = {**windows_body(), **patch}
    assert post(c, body).status_code == 422 and db.saved == []


def test_out_of_range_numbers_are_rejected(client):
    c, _ = client
    assert post(c, windows_body(last_update_days=-1)).status_code == 422
    body = {"module": "m365", "collector_version": "1.0.0", "collected_at": datetime.now(UTC).isoformat(), "summary": {"users_total": 5, "users_with_mfa": 9, "admins_global": 2, "admins_without_mfa": 0}}
    assert post(c, body).status_code == 422  # mais usuários com MFA do que usuários


def test_summary_must_match_the_module(client):
    c, _ = client
    body = windows_body()
    body["module"] = "m365"
    assert post(c, body).status_code == 422


def test_oversized_payload_is_refused(client):
    c, db = client
    assert post(c, None, raw="x" * (256 * 1024 + 1)).status_code == 413
    assert db.saved == []


# ---------------------------------------------------------------- limite de frequência
def test_rate_limit_is_per_token(client):
    c, db = client
    codes = [post(c, windows_body()).status_code for _ in range(11)]
    assert codes[:10] == [202] * 10 and codes[10] == 429


def test_rate_limiter_window():
    now = [1000.0]
    lim = RateLimiter(max_events=2, window_seconds=60, clock=lambda: now[0])
    assert lim.allow("a") and lim.allow("a") and not lim.allow("a")
    assert lim.allow("b")
    now[0] += 61
    assert lim.allow("a")


# ---------------------------------------------------------------- abuso sem token válido (auditoria S02/S03)
def test_declared_oversized_body_is_refused_before_reading_or_touching_the_database(client):
    c, db = client
    r = c.post(
        "/ingest",
        content=b"{}",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "Content-Length": str(50 * 1024 * 1024)},
    )
    assert r.status_code == 413
    assert db.lookups == []


def test_streamed_oversized_body_is_refused(client):
    c, db = client

    def chunks():
        for _ in range(8):
            yield b"x" * (64 * 1024)

    r = c.post("/ingest", content=chunks(), headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    assert r.status_code == 413
    assert db.lookups == [] and db.saved == []


def test_repeated_invalid_tokens_are_throttled_before_the_database(client):
    import app.ingest as ingest

    c, db = client
    db.token = {}  # nenhum token com esse hash
    codes = [post(c, windows_body()).status_code for _ in range(ingest.AUTH_FAILURES_PER_WINDOW + 5)]
    assert codes[: ingest.AUTH_FAILURES_PER_WINDOW] == [401] * ingest.AUTH_FAILURES_PER_WINDOW
    assert set(codes[ingest.AUTH_FAILURES_PER_WINDOW :]) == {429}
    assert len(db.lookups) == ingest.AUTH_FAILURES_PER_WINDOW  # depois do limite o banco não é mais consultado


def test_failed_auth_limit_uses_the_address_added_by_the_proxy(client):
    import app.ingest as ingest

    c, db = client
    db.token = {}
    for _ in range(ingest.AUTH_FAILURES_PER_WINDOW):
        post_from(c, "203.0.113.9, 198.51.100.1")
    # o primeiro valor do X-Forwarded-For vem de quem chama (forjável); o último é o que o proxy viu
    assert post_from(c, "1.2.3.4, 198.51.100.1").status_code == 429
    assert post_from(c, "203.0.113.9, 198.51.100.2").status_code == 401


def post_from(c, forwarded_for):
    return c.post(
        "/ingest",
        content=json.dumps(windows_body()),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "X-Forwarded-For": forwarded_for},
    )
