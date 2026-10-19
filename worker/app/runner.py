"""Loop de jobs: pega um job pendente, executa e grava o resultado."""

import logging
import time
from datetime import UTC, datetime
from typing import Protocol

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


def process_one(db: Db) -> bool:
    """Processa um job. Devolve False se não havia nenhum pendente."""
    job = db.claim_job()
    if job is None:
        return False
    try:
        if job["kind"] == "scan_externo":
            _scan_externo(db, job)
        else:  # processar / relatorio / mensal chegam nas tarefas T06+; devolve para a fila sem gastar tentativa
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
