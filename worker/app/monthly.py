"""Agendador da verificação mensal: a cada ciclo, empresas com plano pago cuja última avaliação tem mais de
30 dias ganham uma avaliação 'mensal' e um job. Quem faz o trabalho é o runner (job 'mensal')."""

import logging
import time
from datetime import UTC, datetime, timedelta
from typing import Protocol

log = logging.getLogger("sentinela.monthly")
INTERVAL_DAYS = 30
CYCLE_SECONDS = 6 * 3600


class SchedulerDb(Protocol):
    def paid_org_ids(self) -> list[str]: ...
    def latest_assessment(self, org_id: str) -> dict | None: ...
    def create_mensal(self, org_id: str) -> None: ...


def schedule_monthly(db: SchedulerDb, now: datetime | None = None) -> list[str]:
    now = now or datetime.now(UTC)
    created = []
    for org_id in db.paid_org_ids():
        latest = db.latest_assessment(org_id)
        if not latest or latest["status"] in ("rascunho", "processando"):
            continue  # nunca fez diagnóstico, ou já há um em andamento
        if now - datetime.fromisoformat(latest["created_at"]) >= timedelta(days=INTERVAL_DAYS):
            db.create_mensal(org_id)
            created.append(org_id)
    return created


def run_scheduler(db: SchedulerDb) -> None:
    while True:
        try:
            made = schedule_monthly(db)
            if made:
                log.info("verificação mensal agendada para %d empresa(s)", len(made))
        except Exception:  # noqa: BLE001 - falha de rede não derruba o agendador
            log.exception("falha ao agendar a verificação mensal")
        time.sleep(CYCLE_SECONDS)
