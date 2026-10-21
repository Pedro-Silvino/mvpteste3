"""Do que o coletor envia (resumos por máquina e do Microsoft 365) para o status de cada controle.
Regras do docs/BASE12.json (campo fontes_automaticas). Só entram valores conhecidos: o que o coletor não
conseguiu ler (None) fica de fora, nunca vira "falha"."""

_RANK = {"nao_atende": 0, "parcial": 1, "atende": 2}
AV_MAX_AGE_DAYS = 7  # assinatura do antivírus com menos de 7 dias
UPDATE_MAX_DAYS = 45  # última atualização instalada há menos de 45 dias


def _tiered(ok: int, total: int) -> str | None:
    """Todas = atende; pelo menos 80% = parcial; senão não atende. Sem nenhum item avaliável = sem status."""
    if total == 0:
        return None
    if ok == total:
        return "atende"
    return "parcial" if ok / total >= 0.8 else "nao_atende"


def _worst(*statuses: str | None) -> str | None:
    known = [s for s in statuses if s]
    return min(known, key=lambda s: _RANK[s]) if known else None


def _machines(devices: list[dict]) -> list[dict]:
    return [d.get("machine", {}) for d in devices]


def _c04(ms: list[dict]) -> str | None:
    known = [m for m in ms if m.get("av_active") is not None and m.get("av_age_days") is not None]
    ok = sum(1 for m in known if m["av_active"] and m["av_age_days"] < AV_MAX_AGE_DAYS)
    return _tiered(ok, len(known))


def _c05(ms: list[dict]) -> str | None:
    known = [m for m in ms if m.get("os_supported") is not None and m.get("last_update_days") is not None]
    ok = sum(1 for m in known if m["os_supported"] and m["last_update_days"] < UPDATE_MAX_DAYS)
    return _tiered(ok, len(known))


def _c09_local(ms: list[dict]) -> str | None:
    known = [m for m in ms if m.get("user_is_local_admin") is not None]
    if not known:
        return None
    admins = sum(1 for m in known if m["user_is_local_admin"])
    if admins == 0:
        return "atende"
    return "parcial" if admins / len(known) <= 0.2 else "nao_atende"


def _c09_m365(m365: dict | None) -> str | None:
    if not m365:
        return None
    n = m365["admins_global"]
    if 2 <= n <= 4:
        return "atende"
    if 5 <= n <= 6:
        return "parcial"
    return "nao_atende"  # só 1, ou mais que 6


def _c10(ms: list[dict]) -> str | None:
    laptops = [m for m in ms if m.get("is_laptop")]
    if not laptops:
        return "atende" if ms else None  # sem portáteis = atende (se houve máquina analisada)
    known = [m for m in laptops if m.get("bitlocker") is not None]
    return _tiered(sum(1 for m in known if m["bitlocker"]), len(known))


def _c03(m365: dict | None) -> str | None:
    if not m365 or m365["users_total"] <= 0:
        return None
    if m365["admins_without_mfa"] > 0:
        return "nao_atende"
    return _tiered_pct(m365["users_with_mfa"] / m365["users_total"])


def _tiered_pct(pct: float) -> str:
    if pct >= 1:
        return "atende"
    return "parcial" if pct >= 0.8 else "nao_atende"


def scan_control_status(devices: list[dict], m365: dict | None) -> dict[str, str]:
    """devices: resumos 'windows' (um por máquina); m365: resumo do tenant. Devolve {controle: status}."""
    ms = _machines(devices)
    candidates = {
        "C03": _c03(m365),
        "C04": _c04(ms),
        "C05": _c05(ms),
        "C09": _worst(_c09_local(ms), _c09_m365(m365)),
        "C10": _c10(ms),
    }
    return {cid: st for cid, st in candidates.items() if st}
