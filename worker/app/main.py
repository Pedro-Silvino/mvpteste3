import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import SupabaseDb, load_env
from app.ingest import router as ingest_router
from app.tprm.api import router as tprm_router
from app.monthly import run_scheduler
from app.runner import run_forever

logging.basicConfig(level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)  # one INFO line per poll is noise
log = logging.getLogger("sentinela.worker")


@asynccontextmanager
async def lifespan(_: FastAPI):
    env = load_env()
    # The job loop runs in a background thread; skipped when the service credentials aren't set (e.g. tests).
    if os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        threading.Thread(target=run_forever, args=(SupabaseDb.from_env(),), kwargs={"warm": True}, daemon=True).start()
        threading.Thread(target=run_scheduler, args=(SupabaseDb.from_env(),), daemon=True).start()
        log.info("fila de jobs e agendador mensal LIGADOS")
    else:
        missing = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY") if not os.environ.get(k)]
        log.warning(
            "fila de jobs DESLIGADA. arquivo .env encontrado=%s (%s); chaves lidas=%s; faltando=%s",
            env["found"], env["path"], env["keys"], missing,
        )
    yield


app = FastAPI(title="Sentinela Worker", lifespan=lifespan)


app.include_router(ingest_router)
app.include_router(tprm_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# O navegador do fornecedor envia provas direto ao worker (evita o limite de corpo da Vercel): só a origem do portal.
load_env()  # APP_ORIGIN pode vir do worker/.env, que o lifespan só leria depois
if os.environ.get("APP_ORIGIN"):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[os.environ["APP_ORIGIN"]],
        allow_methods=["POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-File-Name"],
    )
