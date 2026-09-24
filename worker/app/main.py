from fastapi import FastAPI

app = FastAPI(title="Sentinela Worker")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
