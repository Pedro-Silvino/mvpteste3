import hashlib
import re
from datetime import date

from app.engine.scoring import compute_control_results
from app.report import FOOTER_REST, render_pdf
from app.reports.cyber_insurance import (
    SECTIONS,
    build_dossier_context,
    content_sha256,
    generate_dossier,
    render_dossier_html,
)

BANNED = ["empresa segura", "100% seguro", "risco zero", "certificação", "empresa certificada", "garantia de aceitação", "blindagem", "desconto no seguro"]
ALL = [f"C{i:02d}" for i in range(1, 13)]
TODAY = date(2026, 10, 30)


def vault_item(i, category, created="2026-10-01T10:00:00+00:00", title=None):
    return {"id": f"id{i}", "title": title or f"Evidência {i}", "category": category, "file_hash_sha256": f"{i:x}".rjust(64, "a"), "created_at": created}


def ctx(answers=None, vault=None, verified=False):
    results = compute_control_results(answers or {c: "sim" for c in ALL})
    return build_dossier_context("Empresa Exemplo Ltda", "exemplo.com.br", results, vault if vault is not None else [], TODAY, verified=verified)


def test_sections_cover_the_insurer_topics():
    assert [s["key"] for s in SECTIONS] == ["mfa", "backup", "continuidade", "patch"]


def test_section_ready_only_with_controls_met_and_evidence():
    vault = [vault_item(1, "mfa"), vault_item(2, "backup"), vault_item(3, "continuidade"), vault_item(4, "patch")]
    c = ctx(vault=vault)
    assert all(s["situacao"] == "em_dia" for s in c["secoes"])
    assert c["prontidao"]["em_dia"] == 4


def test_controls_met_without_evidence_is_declared_only():
    c = ctx(vault=[])
    assert all(s["situacao"] == "sem_prova" for s in c["secoes"])
    assert c["prontidao"]["em_dia"] == 0


def test_gap_is_flagged_even_with_evidence():
    answers = {c: "sim" for c in ALL} | {"C03": "nao"}
    c = ctx(answers=answers, vault=[vault_item(1, "mfa")])
    mfa = next(s for s in c["secoes"] if s["key"] == "mfa")
    assert mfa["situacao"] == "lacuna"


def test_shows_only_three_newest_evidence_and_counts_the_rest():
    vault = [vault_item(i, "backup", created=f"2026-0{i}-01T00:00:00+00:00") for i in range(1, 6)]
    backup = next(s for s in ctx(vault=vault)["secoes"] if s["key"] == "backup")
    assert [e["titulo"] for e in backup["evidencias"]] == ["Evidência 5", "Evidência 4", "Evidência 3"]
    assert backup["extras"] == 2
    assert backup["evidencias"][0]["data"] == "01/05/2026"


def test_content_hash_is_deterministic_and_sensitive():
    vault = [vault_item(1, "mfa")]
    a, b = ctx(vault=vault), ctx(vault=vault)
    assert content_sha256(a) == content_sha256(b) and re.fullmatch(r"[a-f0-9]{64}", content_sha256(a))
    assert content_sha256(ctx(vault=[vault_item(2, "mfa")])) != content_sha256(a)
    assert content_sha256(ctx(answers={c: "nao" for c in ALL}, vault=vault)) != content_sha256(a)


def test_html_has_legal_footer_hash_seal_and_no_banned_words():
    c = ctx(vault=[vault_item(1, "mfa")])
    html = render_dossier_html(c, content_sha256(c))
    assert FOOTER_REST in html
    assert f">{c['faixa']['rotulo']}<" in html  # selo da faixa não pode sair vazio
    assert content_sha256(c) in html
    assert "Autoavaliado" in html and "Verificado" not in html
    low = html.lower()
    assert not [w for w in BANNED if w in low]
    assert "R$" not in html  # sem preços (CLAUDE.md §5)


def test_verified_seal_only_when_asked():
    c = ctx(verified=True)
    assert "Verificado" in render_dossier_html(c, "0" * 64)


def test_html_escapes_company_name_and_evidence_titles():
    results = compute_control_results({c: "sim" for c in ALL})
    c = build_dossier_context("<script>x</script>", "e.com.br", results, [vault_item(1, "mfa", title="<img onerror=1>")], TODAY)
    html = render_dossier_html(c, "0" * 64)
    assert "<script>x</script>" not in html and "<img onerror=1>" not in html


def test_unknown_vault_category_is_ignored():
    c = ctx(vault=[vault_item(1, "contrato")])
    assert all(not s["evidencias"] for s in c["secoes"])


def test_generate_dossier_returns_pdf_and_both_hashes():
    c = ctx(vault=[vault_item(1, "mfa"), vault_item(2, "backup")])
    out = generate_dossier(c, render_pdf)
    assert out["pdf"].startswith(b"%PDF")
    assert out["pdf_sha256"] == hashlib.sha256(out["pdf"]).hexdigest()
    assert out["content_sha256"] == content_sha256(c)
    assert len(re.findall(rb"/Type\s*/Page(?![s])", out["pdf"])) == 2
