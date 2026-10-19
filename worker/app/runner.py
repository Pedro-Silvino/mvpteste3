"""Loop de jobs: pega um job pendente, executa e grava o resultado."""

import hashlib
import logging
import time
from datetime import UTC, date, datetime
from typing import Protocol

from app.engine.scoring import compute_control_results, score
from app.report import build_context, render_html, render_pdf
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


def _scan_externo(db: Db, job: dict) -> None:
    domain = db.org_domain(job["org_id"])
    if not domain or not valid_domain(domain):
        raise ValueError("invalid_domain")
    checks = run_external_scan(domain)
    summary = build_summary(domain, checks)
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


def _processar(db: Db, job: dict) -> None:
    org_id, asmt = job["org_id"], job["assessment_id"]
    results = compute_control_results(db.answers(asmt))
    external = db.latest_external_summary(org_id)
    domain = db.org_domain(org_id) or ""
    html = render_html(build_context(domain, results, external, date.today()))
    pdf = render_pdf(html)  # gera o PDF antes de gravar qualquer coisa: falhou aqui, nada fica pela metade
    path = f"{org_id}/{asmt}/express.pdf"
    db.upload_report(path, pdf)
    db.save_report_row(org_id=org_id, assessment_id=asmt, kind="express", storage_path=path,
                       sha256=hashlib.sha256(pdf).hexdigest())
    db.save_control_results(asmt, results)
    db.complete_assessment(asmt, score(results))


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


def run_forever(db: Db, idle_seconds: float = 5.0) -> None:
    while True:
        if not process_one(db):
            time.sleep(idle_seconds)
