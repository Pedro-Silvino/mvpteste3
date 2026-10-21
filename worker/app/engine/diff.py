"""Comparação entre dois meses. Só conta piora comprovada: "sem dado" nunca é piora (nem antes, nem agora)."""

_RANK = {"nao_atende": 0, "parcial": 1, "atende": 2}
_EXT_RANK = {"falha": 0, "parcial": 1, "ok": 2}


def _compare(prev: dict[str, str], cur: dict[str, str], rank: dict[str, int], key: str) -> dict:
    worse, better = [], []
    for item_id, to in cur.items():
        frm = prev.get(item_id)
        if frm not in rank or to not in rank:
            continue
        entry = {key: item_id, "from": frm, "to": to}
        if rank[to] < rank[frm]:
            worse.append(entry)
        elif rank[to] > rank[frm]:
            better.append(entry)
    return {"worse": worse, "better": better}


def diff_results(prev: list[dict], cur: list[dict]) -> dict:
    """prev/cur: linhas de control_results. Sem mês anterior = nada a comparar."""
    if not prev:
        return {"worse": [], "better": []}
    return _compare(
        {r["control_id"]: r["status"] for r in prev}, {r["control_id"]: r["status"] for r in cur}, _RANK, "control_id"
    )


def external_changes(prev: dict[str, str] | None, cur: dict[str, str]) -> dict:
    """prev/cur: {X01: ok|parcial|falha|sem_dado}. Sem checagem anterior = nada a comparar."""
    if not prev:
        return {"worse": [], "better": []}
    return _compare(prev, cur, _EXT_RANK, "check_id")
