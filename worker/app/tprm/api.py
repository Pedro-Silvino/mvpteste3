"""Rotas do módulo TPRM no worker.

- POST /tprm/vendor/{token}/evidence: o fornecedor (sem login) anexa uma prova. O token só existe no banco como
  SHA-256; o tipo real do arquivo vem dos primeiros bytes; o SHA-256 do arquivo é calculado aqui.
- POST /tprm/reassess: reavaliação periódica dos fornecedores homologados, chamada por um agendador externo
  com TPRM_CRON_TOKEN. Sem o token configurado a rota fica desligada (503)."""

import hashlib
import hmac
import logging
import os
import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.db import SupabaseDb
from app.evidence import MAX_BYTES, detect_mime
from app.ingest import AUTH_FAILURES_PER_WINDOW, RateLimiter, _client_address, get_db
from app.tprm import service

log = logging.getLogger("sentinela.tprm")
router = APIRouter(prefix="/tprm")

_TOKEN_RE = re.compile(r"^vnd_[a-f0-9]{64}$")
_CONTROL_RE = re.compile(r"^C[0-9]{2}$")
_EXT = {"application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg"}
MAX_FILES_PER_ASSESSMENT = 20
REASSESS_DAYS = 90

limiter = RateLimiter(max_events=20, window_seconds=3600)  # envios por token
auth_failures = RateLimiter(max_events=AUTH_FAILURES_PER_WINDOW, window_seconds=600)  # token inválido por endereço


def _reply(status: int, code: str) -> JSONResponse:
    return JSONResponse({"detail": code}, status_code=status)


async def _read_limited(request: Request, limit: int) -> bytes | None:
    try:
        if int(request.headers.get("content-length", "0")) > limit:
            return None
    except ValueError:
        return None
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > limit:
            return None
    return bytes(body)


def _usable(assessment: dict | None) -> bool:
    if not assessment or assessment["revoked_at"] or assessment["status"] != "pendente":
        return False
    return datetime.fromisoformat(assessment["token_expires_at"]) > datetime.now(UTC)


def _file_name(raw: str | None) -> str:
    name = re.sub(r"[^A-Za-z0-9._ -]", "", (raw or "arquivo").replace("\\", "/").split("/")[-1])
    return name.strip()[:120] or "arquivo"


@router.post("/vendor/{token}/evidence")
async def vendor_evidence(
    token: str,
    request: Request,
    control: str = Query(...),
    x_file_name: str | None = Header(default=None),
    db: SupabaseDb = Depends(get_db),
):
    address = _client_address(request)
    if auth_failures.blocked(address):
        return _reply(429, "too_many_requests")
    if not _TOKEN_RE.match(token):
        auth_failures.allow(address)
        return _reply(404, "not_found")
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    assessment = await run_in_threadpool(db.find_vendor_assessment, token_hash)
    if not _usable(assessment):
        auth_failures.allow(address)
        return _reply(404, "not_found")  # mesma resposta para inexistente, expirado, revogado ou já enviado
    if not _CONTROL_RE.match(control):
        return _reply(400, "invalid_control")
    if not limiter.allow(token_hash):
        return _reply(429, "too_many_requests")
    if await run_in_threadpool(db.count_vendor_evidence, assessment["id"]) >= MAX_FILES_PER_ASSESSMENT:
        return _reply(429, "too_many_files")

    data = await _read_limited(request, MAX_BYTES)
    if data is None:
        return _reply(413, "too_large")
    mime = detect_mime(data)
    if mime is None:
        return _reply(415, "unsupported_type")

    sha256 = hashlib.sha256(data).hexdigest()
    path = f"{assessment['org_id']}/vendors/{assessment['id']}/{control}-{sha256[:12]}.{_EXT[mime]}"
    try:
        await run_in_threadpool(db.upload_vendor_evidence, path, data, mime)
        await run_in_threadpool(
            lambda: db.save_vendor_evidence_row(
                assessment_id=assessment["id"],
                organization_id=assessment["org_id"],
                control_id=control,
                file_name=_file_name(x_file_name),
                file_path=path,
                file_hash_sha256=sha256,
            )
        )
    except Exception:  # noqa: BLE001 - detalhe só no log interno
        log.exception("falha ao gravar prova de fornecedor")
        return _reply(500, "internal_error")
    return JSONResponse({"sha256": sha256}, status_code=201)


@router.post("/reassess")
async def reassess(authorization: str | None = Header(default=None), db: SupabaseDb = Depends(get_db)):
    secret = os.environ.get("TPRM_CRON_TOKEN", "")
    if len(secret) < 24:
        return _reply(503, "disabled")
    supplied = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not hmac.compare_digest(supplied.encode(), secret.encode()):
        return _reply(401, "unauthorized")
    processed = await run_in_threadpool(service.process_submitted, db)
    result = await run_in_threadpool(service.reassess_due, db, REASSESS_DAYS)
    return {**result, "processadas": processed}
