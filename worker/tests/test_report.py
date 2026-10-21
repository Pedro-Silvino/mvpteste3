import re
from datetime import date

from app.engine.scoring import CONTROLS, compute_control_results
from app.report import FOOTER_REST, build_context, render_html, render_pdf

ALL = [f"C{i:02d}" for i in range(1, 13)]
BANNED = ["empresa segura", "100% seguro", "risco zero", "certificação", "empresa certificada", "garantia de aceitação", "blindagem"]
EXTERNAL = {
    "domain": "exemplo.com.br",
    "score": 60,
    "collected_at": "2026-10-19",
    "checks": {"X01": "ok", "X02": "parcial", "X03": "sem_dado", "X04": "ok", "X05": "falha", "X06": "parcial"},
}
ALL_NO = {c: "nao" for c in ALL}


def ctx(answers=None, external=EXTERNAL, completo=False):
    results = compute_control_results(answers or ALL_NO)
    return build_context("exemplo.com.br", results, external, date(2026, 10, 19), completo=completo)


def pages(pdf: bytes) -> int:
    return len(re.findall(rb"/Type\s*/Page(?![s])", pdf))


# ---------------------------------------------------------------- plano grátis: nada de lacunas


def test_free_context_has_no_gap_data():
    c = ctx()
    assert c["nota"] == 0 and c["faixa"]["rotulo"] == "Exposta" and c["data"] == "19/10/2026"
    assert c["resumo"] == {"atende": 0, "parcial": 0, "nao_atende": 12, "sem_dado": 0}
    assert "lacunas" not in c and "controles" not in c
    assert c["externo"]["score"] == 60 and c["externo"]["checks"] == []


def test_free_html_does_not_reveal_which_controls_or_how_to_fix():
    html = render_html(ctx())
    for cid, control in CONTROLS.items():
        assert control["nome"] not in html, cid
        for step in control["ficha"]:
            assert step not in html, step
    assert "E-mail com DMARC" not in html  # nem o resultado de cada checagem externa
    assert "planos" in html and "R$" not in html
    assert "Retrato do ambiente na data da coleta." in html and FOOTER_REST in html


def test_free_pdf_is_two_pages():
    pdf = render_pdf(render_html(ctx()))
    assert pdf.startswith(b"%PDF") and pages(pdf) == 2


def test_free_html_shows_threat_types_losses_and_opportunities_without_naming_controls():
    c = ctx()
    assert len(c["ameacas"]) == 5 and len(c["oportunidades"]) == 4
    html = render_html(c)
    for t in c["ameacas"]:
        assert t["nome"] in html and t["prejuizo"] in html
    assert "Exposição alto" in html or "Exposição médio" in html
    assert "O que a empresa ganha ao corrigir" in html and c["oportunidades"][0] in html


# ---------------------------------------------------------------- plano pago: lacunas e como resolver


def test_full_context_lists_every_gap_with_fix_steps():
    c = ctx(completo=True)
    assert len(c["lacunas"]) == 12 and len(c["controles"]) == 12
    assert c["lacunas"][0]["ficha"] and c["lacunas"][0]["rotulo"] == "Não atende"
    by_name = {x["nome"]: x for x in c["externo"]["checks"]}
    assert "só monitora" in by_name["E-mail com DMARC"]["significado"]
    assert "Não significa que não exista" in by_name["E-mail com DKIM"]["significado"]


def test_full_html_has_fix_steps_footer_and_no_banned_words():
    html = render_html(ctx(completo=True))
    for cid in ("C03", "C06"):
        for step in CONTROLS[cid]["ficha"]:
            assert step in html, step
    assert "feitas em 19/10/2026" in html
    assert FOOTER_REST in html and "Autoavaliado" in html
    low = html.lower()
    for word in BANNED:
        assert word not in low, word


def test_full_report_skips_controls_that_are_met():
    answers = {c: "sim" for c in ALL} | {"C03": "nao"}
    c = ctx(answers, completo=True)
    assert [g["id"] for g in c["lacunas"]] == ["C03"]
    assert "Nenhuma lacuna" in render_html(ctx({c: "sim" for c in ALL}, completo=True))


def test_full_html_escapes_company_name():
    c = ctx(completo=True)
    c["empresa"] = "<script>alert(1)</script>"
    assert "<script>alert(1)" not in render_html(c)


def test_free_html_without_external_scan_still_renders():
    assert "não estava disponível" in render_html(ctx(external=None))


def test_full_pdf_is_three_pages():
    pdf = render_pdf(render_html(ctx(completo=True)))
    assert pdf.startswith(b"%PDF") and pages(pdf) == 3
