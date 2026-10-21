"""Relatório Express: contexto -> HTML (Jinja, autoescape) -> PDF (Playwright/Chromium)."""

import threading
from datetime import date
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.engine.scoring import CATALOG, CONTROLS, band, opportunities, score, threat_exposure, top_gaps

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
    ("X05", "sem_dado"): "O site bloqueou a checagem automática; não foi possível verificar.",
    ("X06", "sem_dado"): "O site bloqueou a checagem automática; não foi possível verificar.",
    ("X06", "ok"): "HSTS ativo: o navegador exige conexão segura com o site.",
    ("X06", "parcial"): "HSTS ausente. É recomendação de boa prática, não uma falha grave.",
}
SOURCE_LABEL = {"questionario": "Resposta da empresa", "scan": "Verificado pelo coletor", "revisao": "Revisão da equipe"}
NO_DATA_MEANING = "Não foi possível verificar, ou não se aplica a este domínio (ex.: domínio sem e-mail ou sem site)."

_env = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent / "templates"),
    autoescape=select_autoescape(["html"]),
)


def build_context(empresa: str, results: list[dict], external: dict | None, today: date, completo: bool = False) -> dict:
    """completo=False (plano grátis): só nota, contagem e nota externa. As lacunas, o passo a passo e a lista
    de controles NÃO entram no contexto, então não há como vazarem para o PDF gratuito."""
    nota = score(results)
    ctx: dict = {
        "completo": completo,
        "empresa": empresa,
        "data": today.strftime("%d/%m/%Y"),
        "nota": nota,
        "faixa": band(nota),
        "rodape": FOOTER_REST,
        "resumo": {s: sum(1 for r in results if r["status"] == s) for s in ("atende", "parcial", "nao_atende", "sem_dado")},
        "externo": None,
        # Tipos de ataque a que a empresa está exposta (Alto/Médio/Baixo): vale para os dois PDFs e não revela qual
        # controle está em lacuna.
        "ameacas": [
            {**t, "cls": {"Alto": "alto", "Médio": "medio", "Baixo": "baixo"}.get(t["nivel"], "sem")}
            for t in threat_exposure(results, external["checks"] if external else None)
        ],
        "oportunidades": opportunities(),
    }
    if completo:
        ctx["lacunas"] = [
            {**g, "rotulo": STATUS_LABEL[g["status"]]} for g in top_gaps(results, n=len(results))
        ]
        ctx["controles"] = [
            {
                "id": r["control_id"],
                "nome": CONTROLS[r["control_id"]]["nome"],
                "area": CONTROLS[r["control_id"]]["area"],
                "status": r["status"],
                "rotulo": STATUS_LABEL[r["status"]],
                "fonte": SOURCE_LABEL.get(r.get("source", "questionario"), "Resposta"),
                "divergente": bool(r.get("divergence")),
            }
            for r in results
        ]
    if external:
        collected = external.get("collected_at")
        ctx["externo"] = {
            "domain": external["domain"],
            "score": external.get("score"),
            "data": date.fromisoformat(collected).strftime("%d/%m/%Y") if collected else None,
            "checks": [],
        }
        if completo:
            for c in CATALOG["checagens_externas"]:
                status = external["checks"].get(c["id"], "sem_dado")
                rotulo = "Atenção" if status == "parcial" else STATUS_LABEL.get(status, "Sem dado")
                meaning = CHECK_MEANING.get((c["id"], status), NO_DATA_MEANING if status == "sem_dado" else "")
                ctx["externo"]["checks"].append({"nome": c["nome"], "status": status, "rotulo": rotulo, "significado": meaning})
    return ctx


def render_html(ctx: dict) -> str:
    name = "relatorio_completo.html" if ctx["completo"] else "relatorio_gratuito.html"
    return _env.get_template(name).render(**ctx)


_state = threading.local()  # navegador mantido aberto só na thread do worker (warm_up)


def warm_up() -> None:
    """Abre o Chromium uma vez e o reaproveita nos próximos PDFs (poupa ~1 s por relatório). Chamar na thread do worker."""
    from playwright.sync_api import sync_playwright

    if getattr(_state, "browser", None) is None:
        _state.pw = sync_playwright().start()
        _state.browser = _state.pw.chromium.launch()
    render_pdf("<!doctype html><title>aquecimento</title>")  # baixa as fontes e aquece o motor


def _reset_browser() -> None:
    try:
        _state.browser.close()
        _state.pw.stop()
    except Exception:  # noqa: BLE001
        pass
    _state.browser = None


def _print(browser, html: str, footer: str | None = None) -> bytes:
    page = browser.new_page()
    try:
        page.set_content(html, wait_until="load")
        try:  # fontes do Google; sem rede cai nas fontes do sistema
            page.evaluate("document.fonts.ready")
        except Exception:  # noqa: BLE001
            pass
        extra = {"display_header_footer": True, "header_template": "<span></span>", "footer_template": footer} if footer else {}
        return page.pdf(format="A4", print_background=True, prefer_css_page_size=True, **extra)
    finally:
        page.close()


def render_pdf(html: str, footer: str | None = None) -> bytes:
    if getattr(_state, "browser", None) is not None:
        try:
            return _print(_state.browser, html, footer)
        except Exception:  # noqa: BLE001 - navegador morreu: recomeça do zero na próxima
            _reset_browser()
            raise
    from playwright.sync_api import sync_playwright  # import tardio: só quem gera PDF paga o custo

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            return _print(browser, html, footer)
        finally:
            browser.close()
