import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import SupabaseDb, load_env
from app.runner import run_forever

logging.basicConfig(level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)  # one INFO line per poll is noise
log = logging.getLogger("sentinela.worker")


@asynccontextmanager
async def lifespan(_: FastAPI):
    env = load_env()
    # The job loop runs in a background thread; skipped when the service credentials aren't set (e.g. tests).
    if os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        threading.Thread(target=run_forever, args=(SupabaseDb.from_env(),), daemon=True).start()
        log.info("fila de jobs LIGADA")
    else:
        missing = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY") if not os.environ.get(k)]
        log.warning(
            "fila de jobs DESLIGADA. arquivo .env encontrado=%s (%s); chaves lidas=%s; faltando=%s",
            env["found"], env["path"], env["keys"], missing,
        )
    yield


app = FastAPI(title="Sentinela Worker", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
