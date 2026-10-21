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
# O que cada resultado significa, em linguagem de dono. Não afirma mais do que a checagem prova.
CHECK_MEANING = {
    ("X01", "ok"): "Publicado e restritivo: limita quem pode enviar e-mail em nome do domínio.",
    ("X01", "falha"): "Ausente ou permissivo: outro servidor pode se passar pelo domínio da empresa.",
    ("X02", "ok"): "Política ativa: e-mails falsos do domínio são recusados ou separados.",
    ("X02", "parcial"): "Existe, mas só monitora (p=none): e-mails falsos ainda chegam.",
    ("X02", "falha"): "Não encontrado: nada instrui o destinatário a barrar e-mails falsos do domínio.",
    ("X03", "ok"): "Assinatura de e-mail encontrada.",
    ("X03", "sem_dado"): "Não localizada nos nomes mais comuns. Não significa que não exista.",
    ("X04", "ok"): "Certificado válido, com mais de 15 dias de validade.",
    ("X04", "parcial"): "Certificado válido, mas vence em até 15 dias.",
    ("X04", "falha"): "Certificado inválido, vencido, ou o site não responde em HTTPS.",
    ("X05", "ok"): "O endereço sem cadeado (http) leva ao endereço seguro (https).",
    ("X05", "falha"): "O site abre sem cadeado (http), sem redirecionar para o seguro.",
    ("X06", "ok"): "HSTS ativo: o navegador exige conexão segura com o site.",
    ("X06", "parcial"): "HSTS ausente. É recomendação de boa prática, não uma falha grave.",
}
NO_DATA_MEANING = "Não foi possível verificar, ou não se aplica a este domínio (ex.: domínio sem e-mail ou sem site)."

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
        # Só identifica o risco. O passo a passo para corrigir fica dentro do Sentinela (oferta pós-diagnóstico).
        "riscos": [
            {"nome": g["nome"], "por_que": g["por_que"], "status": g["status"], "rotulo": STATUS_LABEL[g["status"]]}
            for g in top_gaps(results)
        ],
        "resumo": {s: sum(1 for r in results if r["status"] == s) for s in ("atende", "parcial", "nao_atende", "sem_dado")},
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
        checks = []
        for c in CATALOG["checagens_externas"]:
            status = external["checks"].get(c["id"], "sem_dado")
            rotulo = "Atenção" if status == "parcial" else STATUS_LABEL.get(status, "Sem dado")
            meaning = CHECK_MEANING.get((c["id"], status), NO_DATA_MEANING if status == "sem_dado" else "")
            checks.append({"nome": c["nome"], "status": status, "rotulo": rotulo, "significado": meaning})
        collected = external.get("collected_at")
        ctx["externo"] = {
            "domain": external["domain"],
            "score": external.get("score"),
            "data": date.fromisoformat(collected).strftime("%d/%m/%Y") if collected else None,
            "checks": checks,
        }
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
