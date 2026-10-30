"""Conector Microsoft 365 sem agente: lê metadados da Microsoft Graph e devolve só contagens.

O token de acesso vem do chamador, vale só durante a chamada e nunca é gravado nem aparece em erro ou log.
Nenhum nome, e-mail ou identificador de usuário sai deste módulo (CLAUDE.md §4.4)."""

import httpx

GRAPH_HOST = "graph.microsoft.com"
GRAPH_BASE = f"https://{GRAPH_HOST}/v1.0"
MAX_PAGES = 50
# SKUs que incluem proteção de identidade (acesso condicional / MFA por política) ou defesa de endpoint.
IDENTITY_SKUS = ("AAD_PREMIUM", "EMS", "SPE_E3", "SPE_E5", "M365_BUSINESS_PREMIUM", "SPB", "O365_BUSINESS_PREMIUM")
SECURITY_SKUS = IDENTITY_SKUS + ("ATP_ENTERPRISE", "DEFENDER", "WIN_DEF_ATP", "THREAT_INTELLIGENCE")


class GraphError(Exception):
    """Falha ao consultar a Graph. A mensagem nunca contém o token."""


def fetch_pages(token: str, path: str, client: httpx.Client | None = None, max_pages: int = MAX_PAGES) -> list[dict]:
    """GET paginado. Segue @odata.nextLink só se apontar para a própria Graph (anti-SSRF)."""
    own = client is None
    client = client or httpx.Client(timeout=20)
    url, rows = f"{GRAPH_BASE}{path}", []
    try:
        for _ in range(max_pages):
            try:
                r = client.get(url, headers={"Authorization": f"Bearer {token}"})
            except httpx.HTTPError as e:
                raise GraphError(f"falha de rede ({type(e).__name__})") from None
            if r.status_code >= 300:
                raise GraphError(f"Graph respondeu HTTP {r.status_code}")
            body = r.json()
            rows.extend(v for v in body.get("value", []) if isinstance(v, dict))
            url = body.get("@odata.nextLink")
            if not url:
                return rows
            parsed = httpx.URL(url)
            if parsed.scheme != "https" or parsed.host != GRAPH_HOST:
                raise GraphError("link de paginação fora da Graph")
        return rows
    finally:
        if own:
            client.close()


def summarize_mfa(registrations: list) -> dict:
    """Contagens de MFA a partir de reports/authenticationMethods/userRegistrationDetails."""
    admins = admins_no = users = users_no = 0
    for r in registrations:
        if not isinstance(r, dict) or not isinstance(r.get("isAdmin"), bool) or not isinstance(r.get("isMfaRegistered"), bool):
            continue
        users += 1
        users_no += not r["isMfaRegistered"]
        if r["isAdmin"]:
            admins += 1
            admins_no += not r["isMfaRegistered"]
    return {"admins_total": admins, "admins_without_mfa": admins_no, "users_total": users, "users_without_mfa": users_no}


def evaluate_mfa(s: dict) -> str:
    """C03: administrador sem MFA é falha; admins ok mas usuários sem MFA é parcial."""
    if s["admins_total"] == 0:
        return "sem_dado"
    if s["admins_without_mfa"] > 0:
        return "falha"
    return "parcial" if s["users_without_mfa"] > 0 else "ok"


def summarize_licenses(skus: list) -> dict:
    """Contagens de licenças de segurança a partir de /subscribedSkus (só o agregado, sem nomes de SKU)."""
    active = consumed = 0
    identity = False
    for s in skus:
        if not isinstance(s, dict):
            continue
        part = str(s.get("skuPartNumber", "")).upper()
        used = s.get("consumedUnits") if isinstance(s.get("consumedUnits"), int) else 0
        enabled = (s.get("prepaidUnits") or {}).get("enabled")
        consumed += used
        if any(part.startswith(p) for p in SECURITY_SKUS) and isinstance(enabled, int) and enabled > 0:
            active += 1
            identity = identity or any(part.startswith(p) for p in IDENTITY_SKUS)
    return {"security_skus_active": active, "has_identity_protection": identity, "licenses_consumed": consumed}


def collect(token: str, client: httpx.Client | None = None) -> dict:
    """Coleta completa: devolve o resumo e o status do controle C03."""
    mfa = summarize_mfa(fetch_pages(token, "/reports/authenticationMethods/userRegistrationDetails", client))
    lic = summarize_licenses(fetch_pages(token, "/subscribedSkus", client))
    return {"mfa": mfa, "licenses": lic, "controls": {"C03": evaluate_mfa(mfa)}}
