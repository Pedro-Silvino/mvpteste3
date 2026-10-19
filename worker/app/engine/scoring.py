"""Nota de maturidade (Base 12). Regra do catálogo: nota = round(100 * soma(peso * valor) / soma(peso));
valor 'sem_dado' (inclui "não sei") conta como 0."""

import json
from pathlib import Path

CATALOG = json.loads((Path(__file__).parent / "base12.json").read_text(encoding="utf-8"))
CONTROLS = {c["id"]: c for c in CATALOG["controles"]}

STATUS_BY_ANSWER = {"sim": "atende", "parcial": "parcial", "nao": "nao_atende", "nao_sei": "sem_dado"}
VALUE_BY_STATUS = {"atende": 1.0, "parcial": 0.5, "nao_atende": 0.0, "sem_dado": 0.0}
_SEVERITY = {"nao_atende": 0, "sem_dado": 1, "parcial": 2}


def compute_control_results(answers: dict[str, str]) -> list[dict]:
    """Uma linha por controle. Resposta ausente ou não oferecida para aquele controle vira sem_dado."""
    rows = []
    for cid, control in CONTROLS.items():
        answer = answers.get(cid)
        status = STATUS_BY_ANSWER.get(answer, "sem_dado") if answer in control["opcoes"] else "sem_dado"
        rows.append({"control_id": cid, "status": status, "source": "questionario", "divergence": False})
    return rows


def score(results: list[dict]) -> int:
    total = sum(CONTROLS[r["control_id"]]["peso"] for r in results)
    got = sum(CONTROLS[r["control_id"]]["peso"] * VALUE_BY_STATUS[r["status"]] for r in results)
    return round(100 * got / total) if total else 0


def band(value: int) -> dict:
    for b in CATALOG["faixas"]:
        if b["min"] <= value <= b["max"]:
            return b
    raise ValueError(f"score out of range: {value}")


def top_gaps(results: list[dict], n: int = 3) -> list[dict]:
    """Maiores lacunas: peso desc, depois gravidade (não atende, sem dado, parcial), depois id."""
    open_ = [r for r in results if r["status"] != "atende"]
    open_.sort(key=lambda r: (-CONTROLS[r["control_id"]]["peso"], _SEVERITY[r["status"]], r["control_id"]))
    out = []
    for r in open_[:n]:
        c = CONTROLS[r["control_id"]]
        out.append(
            {"id": c["id"], "nome": c["nome"], "status": r["status"], "peso": c["peso"], "por_que": c["por_que"], "ficha": c["ficha"]}
        )
    return out
