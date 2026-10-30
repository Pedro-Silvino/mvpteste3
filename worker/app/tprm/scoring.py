"""Score TPRM (0 a 100) de um fornecedor: 60% respostas do fornecedor + 40% superfície externa do domínio dele.

As respostas valem pelo que está comprovado: controle declarado "sim" sem nenhuma prova anexada conta 70%.
Retrato do que o fornecedor declarou e do que a checagem pública enxergou, nunca parecer nem garantia."""

from app.engine.scoring import CONTROLS, VALUE_BY_STATUS, compute_control_results

W_ANSWERS = 0.6
W_EXTERNAL = 0.4
UNPROVEN_FACTOR = 0.7  # "atende" declarado sem prova
HOMOLOGATED_MIN = 70
REJECTED_BELOW = 50
ESSENTIAL = ("C03", "C04", "C05", "C06", "C07", "C12")  # mesma lista de apps/web/lib/readiness.ts (D32)
CRITICALITY_WEIGHT = {"baixa": 1, "media": 2, "alta": 3}


def answers_component(answers: dict[str, str], evidence_controls: set[str]) -> tuple[int, list[str], list[dict]]:
    """Nota das respostas (0-100), controles declarados sem prova e a lista de resultados por controle."""
    results = compute_control_results({k: v for k, v in answers.items() if k in CONTROLS})
    total = sum(CONTROLS[r["control_id"]]["peso"] for r in results)
    got = 0.0
    unproven = []
    for r in results:
        value = VALUE_BY_STATUS[r["status"]]
        if r["status"] == "atende" and r["control_id"] not in evidence_controls:
            value *= UNPROVEN_FACTOR
            unproven.append(r["control_id"])
        got += CONTROLS[r["control_id"]]["peso"] * value
    return (round(100 * got / total) if total else 0), unproven, results


def vendor_status(score: int, results: list[dict]) -> str:
    essentials_ok = all(r["status"] != "nao_atende" for r in results if r["control_id"] in ESSENTIAL)
    if score >= HOMOLOGATED_MIN and essentials_ok:
        return "homologado"
    return "reprovado" if score < REJECTED_BELOW else "concluido"


def tprm_score(answers: dict[str, str], external_score: int | None, evidence_controls: set[str]) -> dict:
    answers_score, unproven, results = answers_component(answers, evidence_controls)
    if external_score is None:
        score = answers_score  # sem checagem externa a nota é só das respostas, e o resultado avisa
    else:
        score = round(W_ANSWERS * answers_score + W_EXTERNAL * external_score)
    return {
        "score": score,
        "answers_score": answers_score,
        "external_score": external_score,
        "external_missing": external_score is None,
        "unproven": unproven,
        "status": vendor_status(score, results),
    }


def chain_score(vendors: list[dict]) -> int | None:
    """Score da cadeia: média dos fornecedores avaliados, ponderada pela criticidade (alta pesa 3, baixa 1)."""
    total = got = 0
    for v in vendors:
        if v.get("tprm_score") is None:
            continue
        w = CRITICALITY_WEIGHT.get(v.get("criticality"), 2)
        total += w
        got += w * v["tprm_score"]
    return round(got / total) if total else None
