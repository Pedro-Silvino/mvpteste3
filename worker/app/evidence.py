"""Evidência enviada pelo cliente: o tipo real vem dos primeiros bytes, nunca do nome nem do navegador.
Mesma regra de apps/web/lib/evidence-client.ts (detectMime)."""

import re

MAX_BYTES = 10 * 1024 * 1024
_SIGNATURES = (
    (b"%PDF-", "application/pdf"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
)


def detect_mime(data: bytes) -> str | None:
    for sig, mime in _SIGNATURES:
        if data.startswith(sig):
            return mime
    return None


def path_belongs_to(path: str, org_id: str, control_id: str) -> bool:
    """O arquivo precisa estar direto na pasta {org}/{controle}/ (sem subpasta, sem '..')."""
    if not re.fullmatch(r"C[0-9]{2}", control_id or ""):
        return False
    prefix = f"{org_id}/{control_id}/"
    rest = path[len(prefix):] if path.startswith(prefix) else ""
    return bool(rest) and "/" not in rest and ".." not in path
