"""Dossiê de ciberseguro: um resumo para a seguradora com os 4 temas que ela mais pergunta (MFA, backup e
restauração, continuidade, atualizações), cada um com a situação dos controles e as evidências do cofre.

Selo "Autoavaliado" (respostas da empresa + checagens automáticas); "Verificado" só se a equipe DataDops revisou.
Autenticidade: o rodapé traz o SHA-256 do conteúdo (os dados que geram o dossiê, em JSON canônico). O SHA-256 do
arquivo PDF não pode estar dentro dele mesmo, então é calculado depois e guardado em `reports` junto do arquivo."""

import hashlib
import json
from collections.abc import Callable
from datetime import date, datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.engine.scoring import band, score
from app.report import FOOTER_REST, STATUS_LABEL

SECTIONS = [
    {"key": "mfa", "titulo": "Verificação em duas etapas (MFA)", "controles": ["C03"], "cofre": "mfa",
     "pergunta": "Os acessos importantes exigem uma segunda confirmação além da senha?"},
    {"key": "backup", "titulo": "Backups e restauração", "controles": ["C06", "C07"], "cofre": "backup",
     "pergunta": "Há cópia dos dados separada do ambiente principal e a restauração é testada?"},
    {"key": "continuidade", "titulo": "Continuidade de negócios e resposta a incidentes", "controles": ["C12"], "cofre": "continuidade",
     "pergunta": "Existe plano escrito para continuar operando e responder a um incidente?"},
    {"key": "patch", "titulo": "Gestão de atualizações (patches)", "controles": ["C05"], "cofre": "patch",
     "pergunta": "Computadores e sistemas recebem as atualizações de segurança em dia?"},
]
SITUACAO_LABEL = {"em_dia": "Controle e prova registrados", "sem_prova": "Controle declarado, sem prova no cofre", "lacuna": "Lacuna a resolver"}
MAX_EVIDENCE_SHOWN = 3
_RANK = {"nao_atende": 0, "sem_dado": 1, "parcial": 2, "atende": 3}

_env = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent.parent / "templates"),
    autoescape=select_autoescape(["html"]),
)


def _br_date(iso: str) -> str:
    return datetime.fromisoformat(iso).strftime("%d/%m/%Y")


def build_dossier_context(empresa: str, dominio: str, results: list[dict], vault: list[dict], today: date, verified: bool = False) -> dict:
    by_control = {r["control_id"]: r["status"] for r in results}
    nota = score(results)
    secoes = []
    for sec in SECTIONS:
        statuses = [by_control.get(c, "sem_dado") for c in sec["controles"]]
        worst = min(statuses, key=lambda s: _RANK[s])
        items = sorted((v for v in vault if v["category"] == sec["cofre"]), key=lambda v: (v["created_at"], v["id"]), reverse=True)
        if worst != "atende":
            situacao = "lacuna"
        else:
            situacao = "em_dia" if items else "sem_prova"
        secoes.append(
            {
                "key": sec["key"],
                "titulo": sec["titulo"],
                "pergunta": sec["pergunta"],
                "controles": [{"id": c, "status": by_control.get(c, "sem_dado"), "rotulo": STATUS_LABEL[by_control.get(c, "sem_dado")]} for c in sec["controles"]],
                "situacao": situacao,
                "situacao_rotulo": SITUACAO_LABEL[situacao],
                "evidencias": [
                    {"titulo": v["title"], "data": _br_date(v["created_at"]), "sha256": v["file_hash_sha256"]} for v in items[:MAX_EVIDENCE_SHOWN]
                ],
                "extras": max(0, len(items) - MAX_EVIDENCE_SHOWN),
            }
        )
    em_dia = sum(1 for s in secoes if s["situacao"] == "em_dia")
    return {
        "empresa": empresa,
        "dominio": dominio,
        "data": today.strftime("%d/%m/%Y"),
        "nota": nota,
        "faixa": band(nota),
        "verificado": verified,
        "secoes": secoes,
        "prontidao": {"em_dia": em_dia, "total": len(secoes)},
        "rodape": FOOTER_REST,
    }


def content_sha256(ctx: dict) -> str:
    """SHA-256 do conteúdo: JSON canônico do contexto, sem o próprio hash."""
    raw = json.dumps(ctx, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def render_dossier_html(ctx: dict, content_hash: str) -> str:
    return _env.get_template("dossie_ciberseguro.html").render(**ctx, content_hash=content_hash)


def generate_dossier(ctx: dict, render_pdf: Callable[[str], bytes]) -> dict:
    content_hash = content_sha256(ctx)
    pdf = render_pdf(render_dossier_html(ctx, content_hash))
    return {"pdf": pdf, "content_sha256": content_hash, "pdf_sha256": hashlib.sha256(pdf).hexdigest()}
