"""Jobs 'evidencia' (o worker confere o arquivo e grava o hash) e 'aviso' (e-mail para a equipe no SOS)."""

import hashlib

from app.runner import process_one

ORG = "11111111-1111-1111-1111-111111111111"
PNG = b"\x89PNG\r\n\x1a\n" + b"x" * 100
PDF = b"%PDF-1.7\n" + b"y" * 50


class EvDb:
    def __init__(self, blob: bytes | None, path=f"{ORG}/C06/abc-backup.png"):
        self.job = {
            "id": "j9", "org_id": ORG, "assessment_id": None, "kind": "evidencia", "attempts": 1,
            "payload": {"path": path, "control": "C06", "file_name": "backup.png", "uploaded_by": "u1"},
        }
        self.blob = blob
        self.rows, self.deleted, self.finished = [], [], []

    def claim_job(self):
        j, self.job = self.job, None
        return j

    def download_evidence(self, path):
        return self.blob

    def delete_evidence_object(self, path):
        self.deleted.append(path)

    def save_evidence_row(self, **kw):
        self.rows.append(kw)

    def finish_job(self, job_id, status, error=None):
        self.finished.append((job_id, status, error))


def test_valid_file_is_registered_with_the_hash_the_worker_computed():
    db = EvDb(PNG)
    process_one(db)
    row = db.rows[0]
    assert row["sha256"] == hashlib.sha256(PNG).hexdigest()
    assert row["mime"] == "image/png" and row["size_bytes"] == len(PNG)
    assert row["org_id"] == ORG and row["control_id"] == "C06" and row["uploaded_by"] == "u1"
    assert row["storage_path"] == f"{ORG}/C06/abc-backup.png" and row["file_name"] == "backup.png"
    assert db.finished == [("j9", "ok", None)] and db.deleted == []


def test_pdf_is_detected_by_its_bytes():
    db = EvDb(PDF, path=f"{ORG}/C06/x-politica.pdf")
    process_one(db)
    assert db.rows[0]["mime"] == "application/pdf"


def test_fake_extension_is_refused_and_the_file_is_removed():
    db = EvDb(b"MZ\x90\x00 executavel disfarcado")  # .png no nome, executável nos bytes
    process_one(db)
    assert db.rows == [] and db.deleted == [f"{ORG}/C06/abc-backup.png"]
    assert db.finished[0][1] == "erro"


def test_oversized_or_empty_file_is_refused():
    for blob in (b"", b"\x89PNG\r\n\x1a\n" + b"x" * (10 * 1024 * 1024)):
        db = EvDb(blob)
        process_one(db)
        assert db.rows == [] and db.finished[0][1] == "erro"


def test_missing_file_is_an_error_without_registering():
    db = EvDb(None)
    process_one(db)
    assert db.rows == [] and db.finished[0][1] == "erro"


def test_path_outside_the_company_folder_is_never_read():
    db = EvDb(PNG, path="22222222-2222-2222-2222-222222222222/C06/x.png")
    db.download_evidence = lambda path: (_ for _ in ()).throw(AssertionError("não pode ler pasta de outra empresa"))
    process_one(db)
    assert db.rows == [] and db.finished[0][1] == "erro"


# ---------------------------------------------------------------- aviso de SOS para a equipe
class NoticeDb:
    def __init__(self):
        self.job = {"id": "j10", "org_id": ORG, "assessment_id": None, "kind": "aviso", "attempts": 1,
                    "payload": {"tipo": "sos", "chamado": "abcd1234"}}
        self.finished = []

    def claim_job(self):
        j, self.job = self.job, None
        return j

    def org_domain(self, org_id):
        return "empresa.com.br"

    def finish_job(self, job_id, status, error=None):
        self.finished.append((job_id, status, error))


def test_sos_notice_emails_the_team_with_domain_and_ticket_only(monkeypatch):
    sent = []
    monkeypatch.setenv("STAFF_ALERT_EMAIL", "equipe@datadops.com.br")
    monkeypatch.setattr("app.runner.send_email", lambda to, subject, html, **kw: sent.append((to, subject, html)) or True)
    db = NoticeDb()
    process_one(db)
    to, subject, html = sent[0]
    assert to == "equipe@datadops.com.br" and "SOS" in subject and "empresa.com.br" in subject
    assert "abcd1234" in html
    assert db.finished == [("j10", "ok", None)]


def test_sos_notice_without_staff_address_finishes_quietly(monkeypatch):
    monkeypatch.delenv("STAFF_ALERT_EMAIL", raising=False)
    monkeypatch.setattr("app.runner.send_email", lambda *a, **kw: (_ for _ in ()).throw(AssertionError("sem destino")))
    db = NoticeDb()
    process_one(db)
    assert db.finished == [("j10", "ok", None)]  # o alerta já está no /staff; e-mail é extra
