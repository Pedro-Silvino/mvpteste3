"""E-mail transacional via Resend. Sem RESEND_API_KEY/MAIL_FROM nada é enviado (devolve False): o painel e os
alertas continuam funcionando, só o aviso por e-mail fica desligado. Nunca levanta exceção para o chamador."""

import logging
import os
import ssl

import httpx

log = logging.getLogger("sentinela.mailer")
RESEND_URL = "https://api.resend.com/emails"


def send_email(to: str, subject: str, html: str, transport: httpx.BaseTransport | None = None) -> bool:
    key, sender = os.environ.get("RESEND_API_KEY"), os.environ.get("MAIL_FROM")
    if not key or not sender or not to:
        return False
    try:
        with httpx.Client(timeout=15, verify=ssl.create_default_context(), transport=transport) as client:
            r = client.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {key}"},
                json={"from": sender, "to": [to], "subject": subject, "html": html},
            )
        if r.status_code >= 300:
            log.warning("e-mail recusado pelo provedor (HTTP %s)", r.status_code)  # sem o endereço no log
            return False
        return True
    except httpx.HTTPError:
        log.warning("falha de rede ao enviar e-mail")
        return False
