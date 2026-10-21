"""Documentos que a empresa pede no painel: política, plano de incidente e designação do responsável.
Modelos-base em templates/docs/, sempre marcados [REVISÃO JURÍDICA]."""

from datetime import date

from app.report import _env

DOC_TITLES = {
    "politica": "Política de Segurança da Informação",
    "plano_incidente": "Plano de Resposta a Incidentes",
    "designacao": "Designação do Responsável pela Segurança",
}

DOC_FOOTER = (
    '<div style="font-size:7pt;color:#52606F;width:100%;padding:0 18mm;display:flex;justify-content:space-between;">'
    "<span>Modelo gerado pelo Sentinela (DataDops). Não substitui análise jurídica. A DataDops não é corretora nem seguradora.</span>"
    '<span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>'
)


def format_cnpj(value: str | None) -> str:
    d = "".join(ch for ch in (value or "") if ch.isdigit())
    if len(d) != 14:
        return ""
    return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"


def build_document_context(
    kind: str, empresa: str, cnpj: str | None, responsavel: str | None, versao: int, today: date
) -> dict:
    if kind not in DOC_TITLES:
        raise ValueError("invalid_document_kind")
    return {
        "titulo": DOC_TITLES[kind],
        "empresa": empresa,
        "cnpj": format_cnpj(cnpj),
        "responsavel": (responsavel or "").strip(),
        "versao": versao,
        "data": today.strftime("%d/%m/%Y"),
    }


def render_document_html(kind: str, ctx: dict) -> str:
    if kind not in DOC_TITLES:
        raise ValueError("invalid_document_kind")
    return _env.get_template(f"docs/{kind}.html").render(**ctx)
