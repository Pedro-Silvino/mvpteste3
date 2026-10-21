"""Acesso ao Supabase pelo worker (service role, só no servidor) via PostgREST."""

import os
import ssl
from datetime import UTC, datetime, timedelta
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
        self.auth_admin = httpx.Client(base_url=f"{url.rstrip('/')}/auth/v1", headers=headers, timeout=20, verify=tls)
        self.storage = httpx.Client(base_url=f"{url.rstrip('/')}/storage/v1", headers=headers, timeout=60, verify=tls)

    @classmethod
    def from_env(cls) -> "SupabaseDb":
        load_env()
        return cls(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    def claim_job(self) -> dict | None:
        r = self.client.get(
            "/jobs",
            params={"status": "eq.pendente", "kind": "in.(scan_externo,processar,relatorio,mensal)", "order": "created_at", "limit": 1},
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

    # ---- agente (coletor)
    def find_agent_token(self, token_hash: str) -> dict | None:
        r = self.client.get(
            "/agent_tokens",
            params={"token_hash": f"eq.{token_hash}", "select": "id,org_id,expires_at,revoked_at", "limit": 1},
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def save_agent_result(self, **kw) -> None:
        kw["collected_at"] = kw["collected_at"].isoformat()
        self.client.post("/scan_results", json={**kw, "collector_version": kw["collector_version"]}).raise_for_status()

    def touch_agent_token(self, token_id: str) -> None:
        self.client.patch(
            "/agent_tokens", params={"id": f"eq.{token_id}"}, json={"last_used_at": datetime.now(UTC).isoformat()}
        ).raise_for_status()

    def latest_agent_summaries(self, org_id: str) -> tuple[list[dict], dict | None]:
        """Último resumo de cada máquina (windows) e o último do Microsoft 365."""
        r = self.client.get(
            "/scan_results",
            params={
                "org_id": f"eq.{org_id}",
                "module": "in.(windows,m365)",
                "order": "received_at.desc",
                "limit": 500,
                "select": "module,device_ref,summary",
            },
        )
        r.raise_for_status()
        devices: dict[str, dict] = {}
        m365 = None
        for row in r.json():
            if row["module"] == "windows" and row["device_ref"] and row["device_ref"] not in devices:
                devices[row["device_ref"]] = row["summary"]
            elif row["module"] == "m365" and m365 is None:
                m365 = row["summary"]
        return list(devices.values()), m365

    def enqueue_completo(self, org_id: str) -> None:
        """Dados novos do coletor: (re)cria a avaliação 'completo' a partir das respostas do Express e enfileira o cálculo."""
        r = self.client.get(
            "/assessments",
            params={"org_id": f"eq.{org_id}", "kind": "eq.express", "status": "eq.concluido", "order": "created_at.desc", "limit": 1, "select": "id,created_by"},
        )
        r.raise_for_status()
        if not r.json():
            return  # sem diagnóstico Express concluído não há respostas para combinar com o coletor
        express = r.json()[0]
        c = self.client.get(
            "/assessments",
            params={"org_id": f"eq.{org_id}", "kind": "eq.completo", "order": "created_at.desc", "limit": 1, "select": "id"},
        )
        c.raise_for_status()
        if c.json():
            asmt = c.json()[0]["id"]
            self.client.patch("/assessments", params={"id": f"eq.{asmt}"}, json={"status": "processando"}).raise_for_status()
        else:
            created = self.client.post(
                "/assessments",
                json={"org_id": org_id, "kind": "completo", "status": "processando", "created_by": express["created_by"]},
                headers={"Prefer": "return=representation"},
            )
            created.raise_for_status()
            asmt = created.json()[0]["id"]
            src = self.client.get("/answers", params={"assessment_id": f"eq.{express['id']}", "select": "question_id,value,answered_by"})
            src.raise_for_status()
            rows = [{**a, "assessment_id": asmt} for a in src.json()]
            if rows:
                self.client.post("/answers", json=rows).raise_for_status()
        pending = self.client.get(
            "/jobs",
            params={"assessment_id": f"eq.{asmt}", "kind": "eq.processar", "status": "in.(pendente,rodando)", "select": "id", "limit": 1},
        )
        pending.raise_for_status()
        if not pending.json():
            self.client.post(
                "/jobs", json={"org_id": org_id, "assessment_id": asmt, "kind": "processar", "payload": {"completo": True}}
            ).raise_for_status()

    # ---- verificação mensal
    def paid_org_ids(self) -> list[str]:
        r = self.client.get("/organizations", params={"plan": "neq.express", "select": "id"})
        r.raise_for_status()
        return [row["id"] for row in r.json()]

    def latest_assessment(self, org_id: str) -> dict | None:
        r = self.client.get(
            "/assessments",
            params={"org_id": f"eq.{org_id}", "order": "created_at.desc", "limit": 1, "select": "id,created_at,kind,status"},
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def create_mensal(self, org_id: str) -> None:
        src = self.client.get(
            "/assessments",
            params={"org_id": f"eq.{org_id}", "status": "eq.concluido", "order": "created_at.desc", "limit": 1, "select": "id,created_by"},
        )
        src.raise_for_status()
        if not src.json():
            return
        source = src.json()[0]
        created = self.client.post(
            "/assessments",
            json={"org_id": org_id, "kind": "mensal", "status": "processando", "created_by": source["created_by"]},
            headers={"Prefer": "return=representation"},
        )
        created.raise_for_status()
        asmt = created.json()[0]["id"]
        answers = self.client.get("/answers", params={"assessment_id": f"eq.{source['id']}", "select": "question_id,value,answered_by"})
        answers.raise_for_status()
        rows = [{**a, "assessment_id": asmt} for a in answers.json()]
        if rows:
            self.client.post("/answers", json=rows).raise_for_status()
        self.client.post("/jobs", json={"org_id": org_id, "assessment_id": asmt, "kind": "mensal"}).raise_for_status()

    def previous_results(self, org_id: str, current_assessment: str) -> tuple[list[dict], int | None]:
        r = self.client.get(
            "/assessments",
            params={
                "org_id": f"eq.{org_id}", "status": "eq.concluido", "id": f"neq.{current_assessment}",
                "order": "created_at.desc", "limit": 1, "select": "id,score",
            },
        )
        r.raise_for_status()
        if not r.json():
            return [], None
        prev = r.json()[0]
        rows = self.client.get("/control_results", params={"assessment_id": f"eq.{prev['id']}", "select": "control_id,status"})
        rows.raise_for_status()
        return rows.json(), prev["score"]

    def previous_external_checks(self, org_id: str) -> dict | None:
        summary = self.latest_external_summary(org_id)
        return summary["checks"] if summary else None

    def insert_alert(self, org_id: str, control_id: str | None, severity: str, message: str) -> None:
        self.client.post(
            "/alerts", json={"org_id": org_id, "control_id": control_id, "severity": severity, "message": message[:500]}
        ).raise_for_status()

    def owner_email(self, org_id: str) -> str | None:
        m = self.client.get("/memberships", params={"org_id": f"eq.{org_id}", "role": "eq.owner", "select": "user_id", "limit": 1})
        m.raise_for_status()
        if not m.json():
            return None
        u = self.auth_admin.get(f"/admin/users/{m.json()[0]['user_id']}")
        if u.status_code != 200:
            return None
        return u.json().get("email") or None  # sessão anônima não tem e-mail

    # ---- robustez
    def mark_assessment_error(self, assessment_id: str) -> None:
        self.client.patch(
            "/assessments", params={"id": f"eq.{assessment_id}", "status": "neq.concluido"}, json={"status": "erro"}
        ).raise_for_status()

    def requeue_stale_jobs(self, older_than_minutes: int = 10) -> None:
        """Job em 'rodando' há mais de N minutos = o worker caiu. Volta para a fila; se já gastou as 3 tentativas, vira erro."""
        limit = (datetime.now(UTC) - timedelta(minutes=older_than_minutes)).isoformat()
        stale = {"status": "eq.rodando", "started_at": f"lt.{limit}"}
        self.client.patch("/jobs", params={**stale, "attempts": "gte.3"}, json={"status": "erro", "error": "worker_timeout"}).raise_for_status()
        self.client.patch("/jobs", params={**stale, "attempts": "lt.3"}, json={"status": "pendente"}).raise_for_status()
