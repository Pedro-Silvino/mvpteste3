"""Relatório Express: contexto -> HTML (Jinja, autoescape) -> PDF (Playwright/Chromium)."""

from datetime import date
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.engine.scoring import CATALOG, CONTROLS, band, score, top_gaps

FOOTER_REST = (
    "Não substitui análise jurídica nem garante aceitação ou indenização por seguradora. "
    "As declarações feitas à seguradora são de responsabilidade da empresa."
)
STATUS_LABEL = {
    "atende": "Atende", "parcial": "Parcial", "nao_atende": "Não atende", "sem_dado": "Sem dado",
    "ok": "OK", "falha": "Falha",
}
_env = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent / "templates"),
    autoescape=select_autoescape(["html"]),
)


def build_context(empresa: str, results: list[dict], external: dict | None, today: date) -> dict:
    nota = score(results)
    ctx = {
        "empresa": empresa,
        "data": today.strftime("%d/%m/%Y"),
        "nota": nota,
        "faixa": band(nota),
        "rodape": FOOTER_REST,
        "lacunas": [{**g, "rotulo": STATUS_LABEL[g["status"]]} for g in top_gaps(results)],
        "controles": [
            {
                "id": r["control_id"],
                "nome": CONTROLS[r["control_id"]]["nome"],
                "area": CONTROLS[r["control_id"]]["area"],
                "status": r["status"],
                "rotulo": STATUS_LABEL[r["status"]],
            }
            for r in results
        ],
        "externo": None,
    }
    if external:
        ctx["externo"] = {
            "domain": external["domain"],
            "score": external.get("score"),
            "checks": [
                {"nome": c["nome"], "status": external["checks"].get(c["id"], "sem_dado"),
                 "rotulo": STATUS_LABEL.get(external["checks"].get(c["id"], "sem_dado"), "Atenção")}
                for c in CATALOG["checagens_externas"]
            ],
        }
        for c in ctx["externo"]["checks"]:
            if c["status"] == "parcial":
                c["rotulo"] = "Atenção"
    return ctx


def render_html(ctx: dict) -> str:
    return _env.get_template("relatorio_express.html").render(**ctx)


def render_pdf(html: str) -> bytes:
    from playwright.sync_api import sync_playwright  # import tardio: só quem gera PDF paga o custo

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            page.set_content(html, wait_until="load")
            try:  # fontes do Google; sem rede cai nas fontes do sistema
                page.evaluate("document.fonts.ready", )
            except Exception:  # noqa: BLE001
                pass
            return page.pdf(format="A4", print_background=True, prefer_css_page_size=True)
        finally:
            browser.close()
