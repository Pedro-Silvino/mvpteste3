"""SupabaseDb: leitura e remoção do arquivo de evidência e fila com os novos tipos de job (sem rede: MockTransport)."""

import httpx

from app.db import SupabaseDb

URL = "https://exemplo.supabase.co"


def make_db(handler) -> tuple[SupabaseDb, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    db = SupabaseDb(URL, "chave-de-teste")
    t = httpx.MockTransport(wrapped)
    db.client = httpx.Client(base_url=f"{URL}/rest/v1", transport=t)
    db.storage = httpx.Client(base_url=f"{URL}/storage/v1", transport=t)
    return db, seen


def test_claim_job_also_takes_evidence_and_notice_jobs():
    db, seen = make_db(lambda r: httpx.Response(200, json=[]))
    assert db.claim_job() is None
    kinds = seen[0].url.params["kind"]
    assert "evidencia" in kinds and "aviso" in kinds


def test_download_evidence_reads_the_private_bucket():
    db, seen = make_db(lambda r: httpx.Response(200, content=b"%PDF-1.7 ok"))
    assert db.download_evidence("o1/C06/a.pdf") == b"%PDF-1.7 ok"
    assert seen[0].method == "GET" and seen[0].url.path == "/storage/v1/object/evidence/o1/C06/a.pdf"


def test_download_evidence_missing_file_is_none():
    db, _ = make_db(lambda r: httpx.Response(404, json={"error": "not_found"}))
    assert db.download_evidence("o1/C06/a.pdf") is None


def test_download_evidence_stops_reading_past_the_limit():
    def chunks():
        for _ in range(11 * 16):  # 11 MB em blocos de 64 KB
            yield b"x" * (64 * 1024)

    db, _ = make_db(lambda r: httpx.Response(200, content=chunks()))
    data = db.download_evidence("o1/C06/a.pdf")
    assert data is not None and len(data) <= 10 * 1024 * 1024 + 64 * 1024  # para logo depois do limite


def test_delete_and_save_row():
    db, seen = make_db(lambda r: httpx.Response(200, json=[]))
    db.delete_evidence_object("o1/C06/a.pdf")
    db.save_evidence_row(org_id="o1", control_id="C06", storage_path="o1/C06/a.pdf", file_name="a.pdf",
                         mime="application/pdf", size_bytes=10, sha256="a" * 64, uploaded_by="u1")
    assert seen[0].method == "DELETE" and seen[0].url.path == "/storage/v1/object/evidence/o1/C06/a.pdf"
    assert seen[1].method == "POST" and seen[1].url.path == "/rest/v1/evidence"
