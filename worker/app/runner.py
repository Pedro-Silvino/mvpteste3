"""Loop de jobs: pega um job pendente, executa e grava o resultado."""

import hashlib
import logging
import time
from datetime import UTC, date, datetime
from typing import Protocol

from app.engine.scoring import compute_control_results, score
from app.documents import DOC_FOOTER, build_document_context, render_document_html
from app.report import build_context, render_html, render_pdf, warm_up
from app.scans.external import (
    build_summary,
    canonical_sha256,
    run_external_scan,
    valid_domain,
)

log = logging.getLogger("sentinela.runner")
MAX_ATTEMPTS = 3
COLLECTOR_VERSION = "external-1.0"


class Db(Protocol):
    def claim_job(self) -> dict | None: ...
    def org_domain(self, org_id: str) -> str | None: ...
    def save_scan_result(self, **kw) -> None: ...
    def set_external_score(self, assessment_id: str, score: int | None) -> None: ...
    def finish_job(self, job_id: str, status: str, error: str | None = None) -> None: ...
    def answers(self, assessment_id: str) -> dict[str, str]: ...
    def latest_external_summary(self, org_id: str) -> dict | None: ...
    def save_control_results(self, assessment_id: str, rows: list[dict]) -> None: ...
    def complete_assessment(self, assessment_id: str, score: int) -> None: ...
    def upload_report(self, path: str, pdf: bytes) -> None: ...
    def save_report_row(self, **kw) -> None: ...
    def has_report(self, assessment_id: str, path: str) -> bool: ...
    def org_profile(self, org_id: str) -> dict | None: ...
    def next_document_version(self, org_id: str, kind: str) -> int: ...
    def upload_document(self, path: str, pdf: bytes) -> None: ...
    def save_document_row(self, **kw) -> None: ...


def _scan_externo(db: Db, job: dict) -> None:
    domain = db.org_domain(job["org_id"])
    if not domain or not valid_domain(domain):
        raise ValueError("invalid_domain")
    checks = run_external_scan(domain)
    summary = build_summary(domain, checks, date.today().isoformat())
    db.save_scan_result(
        org_id=job["org_id"],
        assessment_id=job["assessment_id"],
        module="externo",
        collector_version=COLLECTOR_VERSION,
        summary=summary,
        sha256=canonical_sha256(summary),
        collected_at=datetime.now(UTC),
    )
    if job.get("assessment_id"):
        db.set_external_score(job["assessment_id"], summary["score"])


def _publish(db: Db, org_id: str, asmt: str, path: str, pdf: bytes) -> None:
    db.upload_report(path, pdf)
    db.save_report_row(org_id=org_id, assessment_id=asmt, kind="express", storage_path=path,
                       sha256=hashlib.sha256(pdf).hexdigest())


def _processar(db: Db, job: dict) -> None:
    """Em duas etapas, para a pessoa ver o resultado o mais cedo possível:
    1) nota + PDF grátis -> assessment 'concluido' (a tela de resultado já abre);
    2) PDF completo (lacunas + como resolver) -> aparece no painel logo depois.
    Cada etapa só roda se ainda não foi feita, então uma nova tentativa do job não duplica nada."""
    org_id, asmt = job["org_id"], job["assessment_id"]
    results = compute_control_results(db.answers(asmt))
    external = db.latest_external_summary(org_id)
    domain = db.org_domain(org_id) or ""
    today = date.today()
    free_path = f"{org_id}/{asmt}/express.pdf"
    full_path = f"{org_id}/{asmt}/express-completo.pdf"

    if not db.has_report(asmt, free_path):
        pdf = render_pdf(render_html(build_context(domain, results, external, today)))
        db.save_control_results(asmt, results)
        _publish(db, org_id, asmt, free_path, pdf)
    db.complete_assessment(asmt, score(results))  # libera /resultado

    if not db.has_report(asmt, full_path):
        pdf = render_pdf(render_html(build_context(domain, results, external, today, completo=True)))
        _publish(db, org_id, asmt, full_path, pdf)


def _documento(db: Db, job: dict) -> None:
    """Gera um documento pedido no painel (política, plano de incidente ou designação) e registra o hash."""
    org_id = job["org_id"]
    payload = job.get("payload") or {}
    kind = payload.get("document")
    responsavel = (payload.get("responsavel") or "").strip()
    if kind == "designacao" and not responsavel:
        raise ValueError("responsavel_required")
    profile = db.org_profile(org_id) or {}
    # o nome provisório é o próprio domínio: nesse caso o documento usa o domínio como nome da empresa
    empresa = profile.get("name") or profile.get("domain") or ""
    version = db.next_document_version(org_id, kind)
    ctx = build_document_context(kind, empresa, profile.get("cnpj"), responsavel, version, date.today())  # valida o tipo
    pdf = render_pdf(render_document_html(kind, ctx), DOC_FOOTER)
    path = f"{org_id}/{kind}-v{version}.pdf"
    db.upload_document(path, pdf)
    db.save_document_row(org_id=org_id, kind=kind, version=version, storage_path=path, sha256=hashlib.sha256(pdf).hexdigest())


def process_one(db: Db) -> bool:
    """Processa um job. Devolve False se não havia nenhum pendente."""
    job = db.claim_job()
    if job is None:
        return False
    try:
        if job["kind"] == "scan_externo":
            _scan_externo(db, job)
        elif job["kind"] == "processar":
            _processar(db, job)
        elif job["kind"] == "relatorio":
            _documento(db, job)
        else:  # relatorio / mensal chegam nas tarefas T20+; devolve para a fila
            db.finish_job(job["id"], "pendente", "unsupported_kind")
            return True
        db.finish_job(job["id"], "ok")
    except ValueError as e:  # entrada inválida: repetir não adianta
        db.finish_job(job["id"], "erro", str(e))
    except Exception:  # noqa: BLE001
        log.exception("job %s failed", job["id"])  # detalhe só no log interno
        status = "erro" if job.get("attempts", 0) >= MAX_ATTEMPTS else "pendente"
        db.finish_job(job["id"], status, "scan_failed")
    return True


def run_forever(db: Db, idle_seconds: float = 1.0, warm: bool = False) -> None:
    if warm:
        try:
            warm_up()
        except Exception:  # noqa: BLE001 - sem aquecimento o PDF só demora um pouco mais
            log.exception("falha ao aquecer o Chromium")
    while True:
        try:
            worked = process_one(db)
        except Exception:  # noqa: BLE001 - falha de rede/banco não pode matar o loop
            log.exception("falha ao consultar a fila; tentando de novo")
            worked = False
        if not worked:
            time.sleep(idle_seconds)
