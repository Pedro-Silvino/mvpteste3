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
