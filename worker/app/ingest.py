"""POST /ingest: recebe o resumo que o coletor (agente) da empresa envia.

Regras de segurança (CLAUDE.md §4): o token só existe no banco como SHA-256; o payload é validado de forma rígida
(campo desconhecido = recusado, então lista de e-mails, nomes de usuário ou nome de máquina nunca entram); limite
de tamanho e de frequência por token; erro genérico para quem chama, detalhe só no log interno."""

import hashlib
import logging
import re
import time
from collections import defaultdict, deque
from datetime import UTC, datetime
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.db import SupabaseDb
from app.scans.external import canonical_sha256

log = logging.getLogger("sentinela.ingest")
router = APIRouter()

MAX_BODY_BYTES = 256 * 1024
_TOKEN_RE = re.compile(r"^snt_[a-f0-9]{64}$")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WindowsMachine(_Strict):
    os_supported: bool | None
    last_update_days: int | None = Field(ge=0, le=36500)
    av_active: bool | None
    av_age_days: int | None = Field(ge=0, le=36500)
    user_is_local_admin: bool | None
    is_laptop: bool | None
    bitlocker: bool | None


class WindowsSummary(_Strict):
    machine: WindowsMachine


class M365Summary(_Strict):
    users_total: int = Field(ge=0, le=1_000_000)
    users_with_mfa: int = Field(ge=0, le=1_000_000)
    admins_global: int = Field(ge=0, le=1000)
    admins_without_mfa: int = Field(ge=0, le=1000)

    @model_validator(mode="after")
    def _consistent(self):
        if self.users_with_mfa > self.users_total or self.admins_without_mfa > self.admins_global:
            raise ValueError("inconsistent_counts")
        return self


class IngestPayload(_Strict):
    module: Literal["windows", "m365"]
    collector_version: str = Field(pattern=r"^[0-9A-Za-z.\-]{1,20}$")
    collected_at: datetime
    device_ref: str | None = Field(default=None, pattern=r"^[a-f0-9]{16,64}$")  # hash do hostname, nunca o nome
    summary: dict

    @model_validator(mode="after")
    def _summary_matches_module(self):
        if self.module == "windows":
            if self.device_ref is None:
                raise ValueError("device_ref_required")
            self.summary = WindowsSummary.model_validate(self.summary).model_dump()
        else:
            self.summary = M365Summary.model_validate(self.summary).model_dump()
        return self


class RateLimiter:
    """Janela deslizante em memória (uma instância do worker). Chave = id do token."""

    def __init__(self, max_events: int = 10, window_seconds: int = 3600, clock=time.monotonic):
        self.max, self.window, self.clock = max_events, window_seconds, clock
        self.events: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = self.clock()
        q = self.events[key]
        while q and now - q[0] >= self.window:
            q.popleft()
        if len(q) >= self.max:
            return False
        q.append(now)
        return True


limiter = RateLimiter()


@lru_cache
def get_db() -> SupabaseDb:
    return SupabaseDb.from_env()


def _reply(status: int, code: str) -> JSONResponse:
    return JSONResponse({"detail": code}, status_code=status)


def _valid_token(rec: dict | None) -> bool:
    if not rec or rec.get("revoked_at"):
        return False
    try:
        return datetime.fromisoformat(rec["expires_at"]) > datetime.now(UTC)
    except (KeyError, ValueError, TypeError):
        return False


@router.post("/ingest")
async def ingest(request: Request, authorization: str | None = Header(default=None), db=Depends(get_db)):
    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        return _reply(413, "payload_too_large")

    token = (authorization or "").removeprefix("Bearer ").strip() if (authorization or "").startswith("Bearer ") else ""
    if not _TOKEN_RE.match(token):
        return _reply(401, "unauthorized")
    rec = db.find_agent_token(hashlib.sha256(token.encode()).hexdigest())
    if not _valid_token(rec):
        return _reply(401, "unauthorized")
    if not limiter.allow(rec["id"]):
        return _reply(429, "rate_limited")

    try:
        payload = IngestPayload.model_validate_json(body)
    except ValidationError as e:
        # Só o tipo do erro vai para o log: nunca os valores enviados (podem ser dado pessoal).
        log.warning("ingest payload rejected: %s", sorted({err["type"] for err in e.errors()}))
        return _reply(422, "invalid_payload")

    summary = payload.model_dump(mode="json")["summary"]
    db.save_agent_result(
        org_id=rec["org_id"],
        module=payload.module,
        collector_version=payload.collector_version,
        device_ref=payload.device_ref,
        summary=summary,
        sha256=canonical_sha256(summary),
        collected_at=payload.collected_at,
    )
    db.touch_agent_token(rec["id"])
    db.enqueue_completo(rec["org_id"])
    return JSONResponse({"status": "accepted"}, status_code=202)
