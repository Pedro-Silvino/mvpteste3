"""Avisos imediatos (Slack, Teams, e-mail) para porta crítica aberta e quebra de SPF/DMARC.

As mensagens levam só o domínio e o tipo do problema. Os destinos são validados (https e domínio do
provedor) para o webhook não virar canal de SSRF; a URL do webhook é segredo e nunca vai para o log.
`dispatch` nunca levanta exceção: falha de aviso não derruba a verificação."""

import logging
import re
from collections.abc import Callable
from dataclasses import dataclass

import httpx

from app.mailer import send_email
from app.scans.asm import CRITICAL_PORTS

log = logging.getLogger("sentinela.webhooks")

TITLES = {
    "porta_critica": "Porta crítica aberta na internet",
    "spf_quebrado": "Falha na proteção SPF do e-mail",
    "dmarc_quebrado": "Falha na proteção DMARC do e-mail",
}
HELP = {
    "porta_critica": "Acesso remoto exposto na internet é uma das portas de entrada mais usadas em invasões.",
    "spf_quebrado": "SPF diz quais servidores podem enviar e-mail pelo seu domínio.",
    "dmarc_quebrado": "DMARC manda recusar ou isolar e-mail que finge ser do seu domínio.",
}
_HOSTS = {
    "slack": re.compile(r"^hooks\.slack\.com$"),
    "teams": re.compile(r"^([a-z0-9-]+\.)?(webhook\.office\.com|webhook\.office365\.com|logic\.azure\.com)$"),
}
_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")


@dataclass(frozen=True)
class Alert:
    kind: str
    domain: str
    detail: str


def detect_alerts(domain: str, ports: dict | None, checks: dict, previous: dict | None) -> list[Alert]:
    """Porta crítica aberta sempre avisa. SPF (X01) e DMARC (X02) avisam quando passam a 'falha'
    (ou na primeira coleta, se já nascem em 'falha'); se já estavam em 'falha' não repete o aviso."""
    alerts: list[Alert] = []
    opened = (ports or {}).get("open") or []
    if opened:
        names = ", ".join(f"{CRITICAL_PORTS.get(p, 'porta')} ({p})" for p in opened)
        alerts.append(Alert("porta_critica", domain, names))
    for ctl, kind, label in (("X01", "spf_quebrado", "SPF"), ("X02", "dmarc_quebrado", "DMARC")):
        if checks.get(ctl) == "falha" and (previous or {}).get(ctl) != "falha":
            alerts.append(Alert(kind, domain, label))
    return alerts


def _text(a: Alert) -> str:
    return f"{TITLES[a.kind]} — {a.domain}: {a.detail}. {HELP[a.kind]}"


def build_slack(a: Alert) -> dict:
    return {"text": f":warning: *{TITLES[a.kind]}*\nDomínio: {a.domain}\nDetalhe: {a.detail}\n{HELP[a.kind]}"}


def build_teams(a: Alert) -> dict:
    return {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        "summary": TITLES[a.kind],
        "themeColor": "C0392B",
        "title": TITLES[a.kind],
        "text": f"Domínio: {a.domain}<br>Detalhe: {a.detail}<br>{HELP[a.kind]}",
    }


def validate_target(t: dict) -> bool:
    kind = t.get("type")
    if kind == "email":
        return bool(_EMAIL.match(str(t.get("to", ""))))
    if kind not in _HOSTS:
        return False
    try:
        url = httpx.URL(str(t.get("url", "")))
    except httpx.InvalidURL:
        return False
    return url.scheme == "https" and url.port in (None, 443) and bool(_HOSTS[kind].match(url.host or ""))


def dispatch(
    alert: Alert,
    targets: list[dict],
    transport: httpx.BaseTransport | None = None,
    mailer: Callable[[str, str, str], bool] = send_email,
) -> dict:
    out = {"enviados": 0, "falhas": 0, "ignorados": 0}
    with httpx.Client(timeout=10, transport=transport, follow_redirects=False) as client:
        for t in targets:
            if not validate_target(t):
                out["ignorados"] += 1
                continue
            try:
                if t["type"] == "email":
                    ok = mailer(t["to"], TITLES[alert.kind], f"<p>{_text(alert)}</p>")
                else:
                    body = build_slack(alert) if t["type"] == "slack" else build_teams(alert)
                    ok = client.post(t["url"], json=body).status_code < 300
            except Exception:  # noqa: BLE001 - aviso nunca derruba a verificação
                ok = False
            out["enviados" if ok else "falhas"] += 1
            if not ok:
                log.warning("aviso %s não entregue (%s)", alert.kind, t["type"])  # sem URL nem e-mail no log
    return out
