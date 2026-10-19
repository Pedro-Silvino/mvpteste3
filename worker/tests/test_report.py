import re
from datetime import date

from app.engine.scoring import compute_control_results
from app.report import FOOTER_REST, build_context, render_html, render_pdf

ALL = [f"C{i:02d}" for i in range(1, 13)]
BANNED = ["empresa segura", "100% seguro", "risco zero", "certificação", "empresa certificada", "garantia de aceitação", "blindagem"]
EXTERNAL = {"domain": "exemplo.com.br", "score": 60, "checks": {"X01": "ok", "X02": "parcial", "X03": "sem_dado", "X04": "ok", "X05": "falha", "X06": "parcial"}}


def ctx(answers=None, external=EXTERNAL):
    results = compute_control_results(answers or {c: "nao" for c in ALL})
    return build_context("exemplo.com.br", results, external, date(2026, 10, 19))


def test_context_has_score_band_gaps_and_dates():
    c = ctx()
    assert c["nota"] == 0 and c["faixa"]["rotulo"] == "Exposta"
    assert c["data"] == "19/10/2026"
    assert len(c["lacunas"]) == 3 and c["lacunas"][0]["rotulo"] == "Não atende"
    assert len(c["controles"]) == 12
    assert [x["nome"] for x in c["externo"]["checks"]][:2] == ["E-mail com SPF", "E-mail com DMARC"]


def test_html_has_legal_footer_and_no_banned_words():
    html = render_html(ctx())
    assert "Retrato do ambiente na data da coleta." in html
    assert FOOTER_REST in html
    low = html.lower()
    for word in BANNED:
        assert word not in low, word
    assert "Autoavaliado" in html


def test_html_escapes_company_name():
    c = ctx()
    c["empresa"] = "<script>alert(1)</script>"
    assert "<script>alert(1)" not in render_html(c)


def test_html_without_external_scan_still_renders():
    assert "não estava disponível" in render_html(ctx(external=None))


def test_pdf_is_two_pages():
    pdf = render_pdf(render_html(ctx()))
    assert pdf.startswith(b"%PDF")
    assert len(re.findall(rb"/Type\s*/Page(?![s])", pdf)) == 2
