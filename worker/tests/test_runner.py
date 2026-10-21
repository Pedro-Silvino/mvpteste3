from datetime import datetime

from app.runner import MAX_ATTEMPTS, process_one


class FakeDb:
    def __init__(self, job, domain="exemplo.com.br"):
        self.job = job
        self.domain = domain
        self.saved = []
        self.assessment_updates = []
        self.finished = []

    def claim_job(self):
        j, self.job = self.job, None
        return j

    def org_domain(self, org_id):
        return self.domain

    def save_scan_result(self, **kw):
        self.saved.append(kw)

    def set_external_score(self, assessment_id, score):
        self.assessment_updates.append((assessment_id, score))

    def finish_job(self, job_id, status, error=None, attempts=None):
        self.finished.append((job_id, status, error))


JOB = {"id": "j1", "org_id": "o1", "assessment_id": "a1", "kind": "scan_externo", "attempts": 1}


def test_no_job_returns_false():
    assert process_one(FakeDb(None)) is False


def test_scan_externo_saves_result_score_and_finishes(monkeypatch):
    monkeypatch.setattr("app.runner.run_external_scan", lambda d: {"X01": "ok", "X02": "ok"})
    db = FakeDb(JOB)
    assert process_one(db) is True
    r = db.saved[0]
    assert r["module"] == "externo" and len(r["sha256"]) == 64
    assert r["summary"]["score"] == 100
    assert isinstance(r["collected_at"], datetime)
    assert db.assessment_updates == [("a1", 100)]
    assert db.finished == [("j1", "ok", None)]


def test_unsafe_domain_is_rejected_without_scanning(monkeypatch):
    def boom(_):
        raise AssertionError("must not scan")

    monkeypatch.setattr("app.runner.run_external_scan", boom)
    db = FakeDb(JOB, domain="10.0.0.1")
    process_one(db)
    assert db.saved == []
    assert db.finished[0][1] == "erro"


def test_failure_retries_until_max_attempts(monkeypatch):
    def fail(_):
        raise RuntimeError("x")

    monkeypatch.setattr("app.runner.run_external_scan", fail)
    db = FakeDb({**JOB, "attempts": 1})
    process_one(db)
    assert db.finished[0][1] == "pendente"
    db = FakeDb({**JOB, "attempts": MAX_ATTEMPTS})
    process_one(db)
    assert db.finished[0][1] == "erro"
    assert "x" not in (db.finished[0][2] or "")  # internal detail does not leak into the job row


class ProcDb(FakeDb):
    def __init__(self, job, answers=None, external=None):
        super().__init__(job)
        self._answers = answers if answers is not None else {f"C{i:02d}": "sim" for i in range(1, 13)}
        self._external = external
        self.control_rows = None
        self.completed = None
        self.uploads = []
        self.report_rows = []
        self.events = []

    def answers(self, assessment_id):
        return self._answers

    def latest_external_summary(self, org_id):
        return self._external

    def save_control_results(self, assessment_id, rows):
        self.control_rows = rows

    def complete_assessment(self, assessment_id, score):
        self.completed = (assessment_id, score)
        self.events.append("complete")

    def upload_report(self, path, pdf):
        self.uploads.append((path, pdf))
        self.events.append(path.rsplit("/", 1)[1])

    def has_report(self, assessment_id, path):
        return any(r["storage_path"] == path for r in self.report_rows)

    def save_report_row(self, **kw):
        self.report_rows.append(kw)


PROC = {"id": "j2", "org_id": "o1", "assessment_id": "a1", "kind": "processar", "attempts": 1}


def test_processar_scores_generates_pdf_and_registers_hash(monkeypatch):
    monkeypatch.setattr("app.runner.render_pdf", lambda html: b"%PDF-fake")
    db = ProcDb(PROC, external={"domain": "exemplo.com.br", "score": 80, "checks": {"X01": "ok"}})
    assert process_one(db) is True
    assert db.completed == ("a1", 100)
    assert len(db.control_rows) == 12
    assert [p for p, _ in db.uploads] == ["o1/a1/express.pdf", "o1/a1/express-completo.pdf"]
    import hashlib

    digest = hashlib.sha256(b"%PDF-fake").hexdigest()
    assert db.report_rows == [
        {"org_id": "o1", "assessment_id": "a1", "kind": "express", "storage_path": p, "sha256": digest}
        for p in ("o1/a1/express.pdf", "o1/a1/express-completo.pdf")
    ]
    assert db.finished == [("j2", "ok", None)]


def test_processar_failure_does_not_mark_assessment_complete(monkeypatch):
    def boom(html):
        raise RuntimeError("chromium missing")

    monkeypatch.setattr("app.runner.render_pdf", boom)
    db = ProcDb({**PROC, "attempts": 1})
    process_one(db)
    assert db.report_rows == []
    assert db.finished[0][1] == "pendente"


def test_free_result_is_released_before_the_complete_pdf_is_built(monkeypatch):
    monkeypatch.setattr("app.runner.render_pdf", lambda html: b"%PDF-fake")
    db = ProcDb(PROC)
    process_one(db)
    assert db.events == ["express.pdf", "complete", "express-completo.pdf"]


def test_complete_pdf_failure_keeps_the_free_result_and_retry_does_not_duplicate(monkeypatch):
    calls = {"n": 0}

    def flaky(html):
        calls["n"] += 1
        if calls["n"] == 2:  # the complete PDF
            raise RuntimeError("chromium crashed")
        return b"%PDF-fake"

    monkeypatch.setattr("app.runner.render_pdf", flaky)
    db = ProcDb({**PROC, "attempts": 1})
    process_one(db)
    assert db.completed == ("a1", 100)  # free result already out
    assert [r["storage_path"] for r in db.report_rows] == ["o1/a1/express.pdf"]
    assert db.finished[0][1] == "pendente"

    db.job = {**PROC, "attempts": 2}
    process_one(db)
    assert [r["storage_path"] for r in db.report_rows] == ["o1/a1/express.pdf", "o1/a1/express-completo.pdf"]
    assert db.finished[-1][1] == "ok"


class CompletoDb(ProcDb):
    def __init__(self, job, answers, devices, m365=None):
        super().__init__(job, answers=answers)
        self.devices, self.m365 = devices, m365
        self.kinds = []

    def latest_agent_summaries(self, org_id):
        return self.devices, self.m365

    def save_report_row(self, **kw):
        super().save_report_row(**kw)
        self.kinds.append(kw["kind"])


def machine(**kw):
    base = dict(os_supported=True, last_update_days=5, av_active=True, av_age_days=1, user_is_local_admin=False, is_laptop=False, bitlocker=None)
    base.update(kw)
    return {"machine": base}


COMPLETO = {"id": "j3", "org_id": "o1", "assessment_id": "a2", "kind": "processar", "attempts": 1, "payload": {"completo": True}}


def test_completo_job_combines_answers_with_the_collector_and_flags_divergence(monkeypatch):
    seen = {}
    monkeypatch.setattr("app.runner.render_pdf", lambda html, footer=None: seen.setdefault("html", html).encode())
    answers = {f"C{i:02d}": "sim" for i in range(1, 13)}  # a empresa disse "sim" para tudo
    db = CompletoDb(COMPLETO, answers, devices=[machine(av_active=False)] * 2)  # mas o coletor viu antivírus desligado
    assert process_one(db) is True
    rows = {r["control_id"]: r for r in db.control_rows}
    assert rows["C04"] == {"control_id": "C04", "status": "nao_atende", "source": "scan", "divergence": True}
    assert rows["C05"]["source"] == "scan" and rows["C05"]["divergence"] is False
    assert rows["C01"]["source"] == "questionario"
    assert db.completed[1] < 100  # a nota caiu por causa do scan
    assert db.kinds == ["completo"] and db.uploads[0][0] == "o1/a2/completo.pdf"
    assert "resposta diferente do verificado" in seen["html"] and "Verificado pelo coletor" in seen["html"]
    assert db.finished == [("j3", "ok", None)]


def test_completo_without_collector_data_matches_the_questionnaire(monkeypatch):
    monkeypatch.setattr("app.runner.render_pdf", lambda html, footer=None: b"%PDF")
    answers = {f"C{i:02d}": "sim" for i in range(1, 13)}
    db = CompletoDb(COMPLETO, answers, devices=[])
    process_one(db)
    assert db.completed == ("a2", 100) and {r["source"] for r in db.control_rows} == {"questionario"}
