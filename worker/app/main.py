import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import SupabaseDb, load_env
from app.runner import run_forever

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_env()
    # The job loop runs in a background thread; skipped when the service credentials aren't set (e.g. tests).
    if os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        threading.Thread(target=run_forever, args=(SupabaseDb.from_env(),), daemon=True).start()
    yield


app = FastAPI(title="Sentinela Worker", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
