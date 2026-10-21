import hashlib
from datetime import date

import pytest

from app.documents import DOC_TITLES, build_document_context, format_cnpj, render_document_html
from app.runner import process_one


def ctx(kind="politica", **kw):
    base = dict(kind=kind, empresa="Empresa Exemplo Ltda", cnpj="11222333000181", responsavel="Maria Souza", versao=1, today=date(2026, 10, 22))
    base.update(kw)
    return build_document_context(**base)


def test_titles_cover_the_three_kinds():
    assert set(DOC_TITLES) == {"politica", "plano_incidente", "designacao"}


def test_format_cnpj():
    assert format_cnpj("11222333000181") == "11.222.333/0001-81"
    assert format_cnpj("") == ""
    assert format_cnpj(None) == ""


@pytest.mark.parametrize("kind", sorted(DOC_TITLES))
def test_every_document_is_marked_for_legal_review_and_has_company_data(kind):
    html = render_document_html(kind, ctx(kind))
    assert "[REVISÃO JURÍDICA]" in html
    assert "Empresa Exemplo Ltda" in html and "11.222.333/0001-81" in html
    assert "22/10/2026" in html and "versão 1" in html
    low = html.lower()
    for banned in ["empresa segura", "100% seguro", "risco zero", "blindagem", "garantia de aceitação", "certificação"]:
        assert banned not in low, banned


def test_designation_names_the_responsible_person_and_escapes_html():
    html = render_document_html("designacao", ctx("designacao", responsavel="<b>Maria</b>"))
    assert "designa &lt;b&gt;Maria&lt;/b&gt;" in html
    assert "<b>Maria</b>" not in html


def test_incident_plan_keeps_the_first_steps_and_lgpd_reference():
    html = render_document_html("plano_incidente", ctx("plano_incidente"))
    assert "Primeiros 30 minutos" in html and "art. 48" in html


def test_unknown_kind_is_rejected():
    with pytest.raises(ValueError):
        build_document_context("contrato", "X", None, None, 1, date.today())


# ---------------------------------------------------------------- job 'relatorio' no runner


class DocDb:
    def __init__(self, job, name="Empresa Exemplo Ltda", cnpj="11222333000181", domain="exemplo.com.br"):
        self.job = job
        self.profile = {"name": name, "cnpj": cnpj, "domain": domain}
        self.finished, self.uploads, self.rows = [], [], []

    def claim_job(self):
        j, self.job = self.job, None
        return j

    def org_profile(self, org_id):
        return self.profile

    def next_document_version(self, org_id, kind):
        return 3

    def upload_document(self, path, pdf):
        self.uploads.append((path, pdf))

    def save_document_row(self, **kw):
        self.rows.append(kw)

    def finish_job(self, job_id, status, error=None):
        self.finished.append((job_id, status, error))


def job(kind="politica", responsavel=""):
    return {"id": "j9", "org_id": "o1", "assessment_id": None, "kind": "relatorio", "attempts": 1, "payload": {"document": kind, "responsavel": responsavel}}


def test_document_job_renders_uploads_and_registers_hash(monkeypatch):
    monkeypatch.setattr("app.runner.render_pdf", lambda html, footer=None: b"%PDF-doc")
    db = DocDb(job("politica"))
    assert process_one(db) is True
    assert db.uploads == [("o1/politica-v3.pdf", b"%PDF-doc")]
    assert db.rows == [{"org_id": "o1", "kind": "politica", "version": 3, "storage_path": "o1/politica-v3.pdf", "sha256": hashlib.sha256(b"%PDF-doc").hexdigest()}]
    assert db.finished == [("j9", "ok", None)]


def test_designation_without_responsible_fails_without_retry(monkeypatch):
    monkeypatch.setattr("app.runner.render_pdf", lambda html, footer=None: b"x")
    db = DocDb(job("designacao", responsavel=""))
    process_one(db)
    assert db.uploads == [] and db.finished[0][1] == "erro"


def test_invalid_document_kind_fails_without_retry(monkeypatch):
    monkeypatch.setattr("app.runner.render_pdf", lambda html, footer=None: b"x")
    db = DocDb(job("contrato"))
    process_one(db)
    assert db.uploads == [] and db.finished[0][1] == "erro"


def test_company_name_falls_back_to_domain_when_not_filled(monkeypatch):
    seen = {}
    monkeypatch.setattr("app.runner.render_pdf", lambda html, footer=None: seen.setdefault("html", html).encode()[:8])
    db = DocDb(job("politica"), name="exemplo.com.br", cnpj=None)
    process_one(db)
    assert "exemplo.com.br" in seen["html"] and "CNPJ" not in seen["html"]
