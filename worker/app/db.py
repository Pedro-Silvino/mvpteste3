"""Acesso ao Supabase pelo worker (service role, só no servidor) via PostgREST."""

import os
import ssl
from datetime import datetime, UTC
from pathlib import Path

import httpx


def load_env(path: Path = Path(__file__).resolve().parent.parent / ".env") -> dict:
    """Carrega worker/.env (se existir) sem sobrescrever variáveis já definidas. Nunca imprime valores.
    Aceita BOM do Windows, CRLF, 'export ' e aspas. Devolve só metadados (arquivo achado? quais chaves)."""
    status = {"path": str(path), "found": path.is_file(), "keys": []}
    if not status["found"]:
        return status
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip().removeprefix("export ").strip()
        os.environ.setdefault(key, value.strip().strip('"').strip("'"))
        status["keys"].append(key)
    return status


class SupabaseDb:
    def __init__(self, url: str, service_key: str):
        # System trust store (Windows/corporate proxies), not only the bundled certifi list.
        tls = ssl.create_default_context()
        headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
        self.client = httpx.Client(base_url=f"{url.rstrip('/')}/rest/v1", headers=headers, timeout=20, verify=tls)
        self.storage = httpx.Client(base_url=f"{url.rstrip('/')}/storage/v1", headers=headers, timeout=60, verify=tls)

    @classmethod
    def from_env(cls) -> "SupabaseDb":
        load_env()
        return cls(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    def claim_job(self) -> dict | None:
        r = self.client.get(
            "/jobs",
            params={"status": "eq.pendente", "kind": "in.(scan_externo,processar,relatorio)", "order": "created_at", "limit": 1},
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            return None
        job = rows[0]
        # Conditional update = atomic claim: only one worker flips pendente -> rodando.
        c = self.client.patch(
            "/jobs",
            params={"id": f"eq.{job['id']}", "status": "eq.pendente"},
            json={"status": "rodando", "attempts": job["attempts"] + 1, "started_at": datetime.now(UTC).isoformat()},
            headers={"Prefer": "return=representation"},
        )
        c.raise_for_status()
        claimed = c.json()
        return claimed[0] if claimed else None

    def org_domain(self, org_id: str) -> str | None:
        r = self.client.get("/organizations", params={"id": f"eq.{org_id}", "select": "domain"})
        r.raise_for_status()
        rows = r.json()
        return rows[0]["domain"] if rows else None

    def save_scan_result(self, **kw) -> None:
        kw["collected_at"] = kw["collected_at"].isoformat()
        self.client.post("/scan_results", json=kw).raise_for_status()

    def set_external_score(self, assessment_id: str, score: int | None) -> None:
        self.client.patch(
            "/assessments", params={"id": f"eq.{assessment_id}"}, json={"external_score": score}
        ).raise_for_status()

    def finish_job(self, job_id: str, status: str, error: str | None = None) -> None:
        body = {"status": status, "error": error}
        if status in ("ok", "erro"):
            body["finished_at"] = datetime.now(UTC).isoformat()
        self.client.patch("/jobs", params={"id": f"eq.{job_id}"}, json=body).raise_for_status()

    def answers(self, assessment_id: str) -> dict[str, str]:
        r = self.client.get("/answers", params={"assessment_id": f"eq.{assessment_id}", "select": "question_id,value"})
        r.raise_for_status()
        return {row["question_id"]: row["value"] for row in r.json()}

    def latest_external_summary(self, org_id: str) -> dict | None:
        r = self.client.get(
            "/scan_results",
            params={"org_id": f"eq.{org_id}", "module": "eq.externo", "order": "received_at.desc", "limit": 1, "select": "summary"},
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0]["summary"] if rows else None

    def save_control_results(self, assessment_id: str, rows: list[dict]) -> None:
        body = [{**row, "assessment_id": assessment_id} for row in rows]
        # merge-duplicates: a retried job overwrites instead of failing on the primary key
        self.client.post(
            "/control_results", json=body, params={"on_conflict": "assessment_id,control_id"},
            headers={"Prefer": "resolution=merge-duplicates"},
        ).raise_for_status()

    def complete_assessment(self, assessment_id: str, score: int) -> None:
        self.client.patch(
            "/assessments", params={"id": f"eq.{assessment_id}"},
            json={"status": "concluido", "score": score, "completed_at": datetime.now(UTC).isoformat()},
        ).raise_for_status()

    def upload_report(self, path: str, pdf: bytes) -> None:
        self.storage.post(
            f"/object/reports/{path}", content=pdf, headers={"Content-Type": "application/pdf", "x-upsert": "true"}
        ).raise_for_status()

    def save_report_row(self, **kw) -> None:
        self.client.post("/reports", json=kw).raise_for_status()

    def has_report(self, assessment_id: str, path: str) -> bool:
        r = self.client.get(
            "/reports",
            params={"assessment_id": f"eq.{assessment_id}", "storage_path": f"eq.{path}", "select": "id", "limit": 1},
        )
        r.raise_for_status()
        return bool(r.json())

    def org_profile(self, org_id: str) -> dict | None:
        r = self.client.get("/organizations", params={"id": f"eq.{org_id}", "select": "name,cnpj,domain"})
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def next_document_version(self, org_id: str, kind: str) -> int:
        r = self.client.get(
            "/documents",
            params={"org_id": f"eq.{org_id}", "kind": f"eq.{kind}", "select": "version", "order": "version.desc", "limit": 1},
        )
        r.raise_for_status()
        rows = r.json()
        return (rows[0]["version"] + 1) if rows else 1

    def upload_document(self, path: str, pdf: bytes) -> None:
        self.storage.post(
            f"/object/documents/{path}", content=pdf, headers={"Content-Type": "application/pdf", "x-upsert": "true"}
        ).raise_for_status()

    def save_document_row(self, **kw) -> None:
        self.client.post("/documents", json=kw).raise_for_status()
