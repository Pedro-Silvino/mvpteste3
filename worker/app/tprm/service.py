"""Processa avaliações enviadas por fornecedores e reavalia periodicamente os homologados.
A checagem externa é a pública (DNS, certificado, cabeçalhos): nenhuma varredura de portas do fornecedor."""

import logging
from collections.abc import Callable

from app.scans.external import external_score, run_external_scan, valid_domain
from app.tprm.scoring import tprm_score

log = logging.getLogger("sentinela.tprm")
Scan = Callable[[str], dict[str, str]]


def _external(domain: str, scan: Scan) -> int | None:
    if not valid_domain(domain):
        return None
    try:
        return external_score(scan(domain))
    except Exception:  # noqa: BLE001 - falha de rede não impede a nota das respostas
        log.warning("checagem externa do fornecedor falhou")
        return None


def _save(db, row: dict, assessment_id: str, result: dict) -> None:
    db.save_vendor_result(
        assessment_id=assessment_id,
        vendor_id=row["vendor_id"],
        answers_score=result["answers_score"],
        external_score=result["external_score"],
        tprm_score=result["score"],
        status=result["status"],
    )


def process_submitted(db, scan: Scan = run_external_scan) -> int:
    done = 0
    for row in db.pending_vendor_assessments():
        try:
            result = tprm_score(row["answers"], _external(row["domain"], scan), db.vendor_evidence_controls(row["id"]))
            _save(db, row, row["id"], result)
            done += 1
        except Exception:  # noqa: BLE001 - uma avaliação com defeito não trava as outras
            log.exception("falha ao processar avaliação de fornecedor %s", row.get("id"))
    return done


def reassess_due(db, days: int = 90, scan: Scan = run_external_scan) -> dict:
    """Refaz a checagem externa dos fornecedores sem avaliação há `days` dias, mantendo as respostas e provas
    da última avaliação enviada. Quem era homologado e deixa de ser gera um aviso para a empresa contratante."""
    done = downgraded = 0
    for row in db.vendors_due(days):
        try:
            result = tprm_score(row["answers"], _external(row["domain"], scan), db.vendor_evidence_controls(row["assessment_id"]))
            _save(db, row, row["assessment_id"], result)
            done += 1
            if row["status"] == "homologado" and result["status"] != "homologado":
                downgraded += 1
                db.insert_alert(
                    row["org_id"],
                    None,
                    "atencao",
                    f"O fornecedor {row['vendor_name']} deixou de atender ao nível de homologação na reavaliação (nota {result['score']}).",
                )
        except Exception:  # noqa: BLE001
            log.exception("falha ao reavaliar fornecedor %s", row.get("vendor_id"))
    return {"reavaliados": done, "rebaixados": downgraded}
