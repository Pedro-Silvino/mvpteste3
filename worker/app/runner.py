"""Loop de jobs: pega um job pendente, executa e grava o resultado."""

import hashlib
import logging
import time
from datetime import UTC, date, datetime
from typing import Protocol

from app.engine.mapping import scan_control_status
from app.engine.scoring import compute_control_results, score
from app.engine.diff import diff_results, external_changes
from app.documents import DOC_FOOTER, build_document_context, render_document_html
from app.mailer import send_email
from app.report import build_context, build_monthly_context, render_html, render_monthly_html, render_pdf, warm_up
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
    def mark_assessment_error(self, assessment_id: str) -> None: ...
    def requeue_stale_jobs(self) -> None: ...
    def latest_agent_summaries(self, org_id: str) -> tuple[list[dict], dict | None]: ...
    def previous_results(self, org_id: str, current_assessment: str) -> tuple[list[dict], int | None]: ...
    def previous_external_checks(self, org_id: str) -> dict | None: ...
    def insert_alert(self, org_id: str, control_id: str | None, severity: str, message: str) -> None: ...
    def owner_email(self, org_id: str) -> str | None: ...
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


def _publish(db: Db, org_id: str, asmt: str, path: str, pdf: bytes, kind: str = "express") -> None:
    db.upload_report(path, pdf)
    db.save_report_row(org_id=org_id, assessment_id=asmt, kind=kind, storage_path=path,
                       sha256=hashlib.sha256(pdf).hexdigest())


def _processar_completo(db: Db, job: dict) -> None:
    """Respostas do Express + o que o coletor viu (o scan manda mais que a resposta, divergência marcada)."""
    org_id, asmt = job["org_id"], job["assessment_id"]
    devices, m365 = db.latest_agent_summaries(org_id)
    results = compute_control_results(db.answers(asmt), scan_control_status(devices, m365))
    external = db.latest_external_summary(org_id)
    domain = db.org_domain(org_id) or ""
    pdf = render_pdf(render_html(build_context(domain, results, external, date.today(), completo=True)))
    db.save_control_results(asmt, results)
    _publish(db, org_id, asmt, f"{org_id}/{asmt}/completo.pdf", pdf, kind="completo")
    db.complete_assessment(asmt, score(results))


def _processar(db: Db, job: dict) -> None:
    if (job.get("payload") or {}).get("completo"):
        return _processar_completo(db, job)
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


_LABEL = {"atende": "Atende", "parcial": "Parcial", "nao_atende": "Não atende", "sem_dado": "Sem dado"}


def _mensal(db: Db, job: dict) -> None:
    """Verificação do mês: nova checagem pública, recálculo, comparação com o mês anterior, alertas só quando algo
    PIOROU (comprovadamente), relatório de 1 página e e-mail ao dono quando houver piora."""
    org_id, asmt = job["org_id"], job["assessment_id"]
    domain = db.org_domain(org_id) or ""
    prev_checks = db.previous_external_checks(org_id)  # lido antes de gravar o scan novo
    ext_summary = None
    if valid_domain(domain):
        checks = run_external_scan(domain)
        ext_summary = build_summary(domain, checks, date.today().isoformat())
        db.save_scan_result(org_id=org_id, assessment_id=asmt, module="externo", collector_version=COLLECTOR_VERSION,
                            summary=ext_summary, sha256=canonical_sha256(ext_summary), collected_at=datetime.now(UTC))
    devices, m365 = db.latest_agent_summaries(org_id)
    results = compute_control_results(db.answers(asmt), scan_control_status(devices, m365))
    prev_rows, prev_score = db.previous_results(org_id, asmt)
    diff = diff_results(prev_rows, results)
    ext_diff = external_changes(prev_checks, ext_summary["checks"]) if ext_summary else {"worse": [], "better": []}

    from app.engine.scoring import CATALOG, CONTROLS  # noqa: PLC0415 - só nomes legíveis para a mensagem

    ext_names = {c["id"]: c["nome"] for c in CATALOG["checagens_externas"]}
    lines = []
    for w in diff["worse"]:
        name = CONTROLS[w["control_id"]]["nome"]
        text = f"{name} piorou: de {_LABEL[w['from']]} para {_LABEL[w['to']]}. Avalie com o seu corretor se é preciso comunicar a seguradora."
        db.insert_alert(org_id, w["control_id"], "critico" if w["to"] == "nao_atende" else "atencao", text)
        lines.append(text)
    for w in ext_diff["worse"]:
        text = f"Checagem pública piorou: {ext_names.get(w['check_id'], w['check_id'])} ({w['from']} para {w['to']})."
        db.insert_alert(org_id, None, "atencao", text)
        lines.append(text)

    ctx = build_monthly_context(domain, results, prev_score, diff, ext_diff, date.today())
    pdf = render_pdf(render_monthly_html(ctx))
    db.save_control_results(asmt, results)
    _publish(db, org_id, asmt, f"{org_id}/{asmt}/mensal.pdf", pdf, kind="mensal")
    db.complete_assessment(asmt, score(results))

    if lines and (to := db.owner_email(org_id)):
        body = "<p>A verificação mensal do Sentinela encontrou mudanças em " + domain + ":</p><ul>" + "".join(f"<li>{ln}</li>" for ln in lines) + "</ul><p>Veja os detalhes no painel.</p>"
        send_email(to, "Sentinela: algo piorou na verificação do mês", body)


def _fail_assessment(db: Db, job: dict) -> None:
    """Job desistiu de vez: o diagnóstico vai para 'erro' (a tela deixa de girar e avisa), em vez de ficar 'processando'."""
    if job.get("assessment_id") and job["kind"] in ("processar", "mensal", "scan_externo"):
        try:
            db.mark_assessment_error(job["assessment_id"])
        except Exception:  # noqa: BLE001
            log.exception("não consegui marcar o diagnóstico como erro")


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
        elif job["kind"] == "mensal":
            _mensal(db, job)
        else:  # relatorio / mensal chegam nas tarefas T20+; devolve para a fila
            db.finish_job(job["id"], "pendente", "unsupported_kind")
            return True
        db.finish_job(job["id"], "ok")
    except ValueError as e:  # entrada inválida: repetir não adianta
        db.finish_job(job["id"], "erro", str(e))
        _fail_assessment(db, job)
    except Exception:  # noqa: BLE001
        log.exception("job %s failed", job["id"])  # detalhe só no log interno
        status = "erro" if job.get("attempts", 0) >= MAX_ATTEMPTS else "pendente"
        db.finish_job(job["id"], status, "scan_failed")
        if status == "erro":
            _fail_assessment(db, job)
    return True


STALE_CHECK_EVERY = 60  # polls entre verificações de job travado


def run_forever(db: Db, idle_seconds: float = 1.0, warm: bool = False) -> None:
    if warm:
        try:
            warm_up()
        except Exception:  # noqa: BLE001 - sem aquecimento o PDF só demora um pouco mais
            log.exception("falha ao aquecer o Chromium")
    polls = 0
    while True:
        if polls % STALE_CHECK_EVERY == 0:
            try:
                db.requeue_stale_jobs()  # worker que caiu no meio de um job deixa ele em "rodando"
            except Exception:  # noqa: BLE001
                log.exception("falha ao recuperar jobs travados")
        polls += 1
        try:
            worked = process_one(db)
        except Exception:  # noqa: BLE001 - falha de rede/banco não pode matar o loop
            log.exception("falha ao consultar a fila; tentando de novo")
            worked = False
        if not worked:
            time.sleep(idle_seconds)
