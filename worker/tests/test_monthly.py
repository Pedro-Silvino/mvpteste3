from datetime import UTC, date, datetime, timedelta

import httpx

from app.engine.diff import diff_results, external_changes
from app.mailer import send_email
from app.monthly import schedule_monthly
from app.runner import process_one

ALL = [f"C{i:02d}" for i in range(1, 13)]


def rows(**status):
    base = {c: "atende" for c in ALL}
    base.update(status)
    return [{"control_id": c, "status": s} for c, s in base.items()]


# ---------------------------------------------------------------- diff.py
def test_diff_lists_only_controls_that_got_worse():
    prev = rows(C03="atende", C04="parcial", C06="nao_atende")
    cur = rows(C03="nao_atende", C04="atende", C06="nao_atende")
    d = diff_results(prev, cur)
    assert [w["control_id"] for w in d["worse"]] == ["C03"]
    assert d["worse"][0]["from"] == "atende" and d["worse"][0]["to"] == "nao_atende"
    assert [b["control_id"] for b in d["better"]] == ["C04"]


def test_diff_ignores_no_data_both_ways_and_handles_a_missing_previous_month():
    assert diff_results(rows(C03="sem_dado"), rows(C03="nao_atende"))["worse"] == []  # antes não se sabia: não é piora
    assert diff_results(rows(C03="atende"), rows(C03="sem_dado"))["worse"] == []  # perdeu dado: não acusar piora
    assert diff_results([], rows(C03="nao_atende")) == {"worse": [], "better": []}


def test_external_changes_report_only_real_drops():
    prev = {"X01": "ok", "X02": "ok", "X03": "sem_dado", "X04": "ok"}
    cur = {"X01": "ok", "X02": "parcial", "X03": "falha", "X04": "sem_dado"}
    drops = {c["check_id"] for c in external_changes(prev, cur)["worse"]}
    assert drops == {"X02"}  # X03 vinha sem dado, X04 perdeu dado: nenhum dos dois é piora comprovada
    assert external_changes(None, cur) == {"worse": [], "better": []}


# ---------------------------------------------------------------- mailer
def test_email_is_skipped_without_credentials(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    assert send_email("a@b.com", "oi", "<p>x</p>") is False


def test_email_is_sent_through_resend_when_configured(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test")
    monkeypatch.setenv("MAIL_FROM", "Sentinela <alertas@datadops.com.br>")
    sent = {}

    def handler(request: httpx.Request) -> httpx.Response:
        sent["auth"] = request.headers["authorization"]
        sent["body"] = request.content.decode()
        return httpx.Response(200, json={"id": "1"})

    assert send_email("dono@empresa.com.br", "Assunto", "<p>oi</p>", transport=httpx.MockTransport(handler)) is True
    assert sent["auth"] == "Bearer re_test" and "dono@empresa.com.br" in sent["body"] and "Assunto" in sent["body"]


def test_email_failure_never_raises(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test")
    monkeypatch.setenv("MAIL_FROM", "x@y.com")
    assert send_email("a@b.com", "s", "h", transport=httpx.MockTransport(lambda r: httpx.Response(500))) is False


# ---------------------------------------------------------------- agendador
class SchedDb:
    def __init__(self, orgs, latest):
        self._orgs, self._latest = orgs, latest
        self.created = []

    def paid_org_ids(self):
        return self._orgs

    def latest_assessment(self, org_id):
        return self._latest.get(org_id)

    def create_mensal(self, org_id):
        self.created.append(org_id)


NOW = datetime(2026, 11, 20, tzinfo=UTC)


def test_scheduler_creates_a_monthly_run_only_for_orgs_that_are_due():
    db = SchedDb(
        ["old", "recent", "none", "running"],
        {
            "old": {"id": "a1", "created_at": (NOW - timedelta(days=31)).isoformat(), "kind": "completo", "status": "concluido"},
            "recent": {"id": "a2", "created_at": (NOW - timedelta(days=10)).isoformat(), "kind": "mensal", "status": "concluido"},
            "running": {"id": "a3", "created_at": (NOW - timedelta(days=40)).isoformat(), "kind": "mensal", "status": "processando"},
        },
    )
    assert schedule_monthly(db, NOW) == ["old"]
    assert db.created == ["old"]  # "none" tem plano pago mas nunca fez diagnóstico: nada a repetir


# ---------------------------------------------------------------- job 'mensal'
class MonthlyDb:
    def __init__(self, prev_rows, cur_answers=None):
        self.job = {"id": "j7", "org_id": "o1", "assessment_id": "m1", "kind": "mensal", "attempts": 1, "payload": {}}
        self.prev_rows = prev_rows
        self.cur_answers = cur_answers or {c: "sim" for c in ALL}
        self.alerts, self.uploads, self.report_rows, self.scans, self.finished, self.emails = [], [], [], [], [], []
        self.completed = None
        self.control_rows = None

    def claim_job(self):
        j, self.job = self.job, None
        return j

    def org_domain(self, org_id):
        return "exemplo.com.br"

    def answers(self, asmt):
        return self.cur_answers

    def latest_agent_summaries(self, org_id):
        return [], None

    def previous_results(self, org_id, current_assessment):
        return self.prev_rows, 80

    def previous_external_checks(self, org_id):
        return {"X01": "ok", "X02": "ok", "X03": "ok", "X04": "ok", "X05": "ok", "X06": "ok"}

    def save_scan_result(self, **kw):
        self.scans.append(kw)

    def save_control_results(self, asmt, rows):
        self.control_rows = rows

    def insert_alert(self, org_id, control_id, severity, message):
        self.alerts.append((control_id, severity, message))

    def upload_report(self, path, pdf):
        self.uploads.append(path)

    def save_report_row(self, **kw):
        self.report_rows.append(kw)

    def complete_assessment(self, asmt, score):
        self.completed = (asmt, score)

    def owner_email(self, org_id):
        return "dono@empresa.com.br"

    def finish_job(self, job_id, status, error=None):
        self.finished.append((job_id, status, error))


def patch_io(monkeypatch, ext=None):
    monkeypatch.setattr("app.runner.render_pdf", lambda html, footer=None: b"%PDF-mensal")
    monkeypatch.setattr("app.runner.run_external_scan", lambda d: ext or {"X01": "ok", "X02": "ok", "X03": "ok", "X04": "ok", "X05": "ok", "X06": "ok"})
    sent = []
    monkeypatch.setattr("app.runner.send_email", lambda to, subject, html, **kw: sent.append((to, subject)) or True)
    return sent


def test_monthly_job_alerts_only_on_worsening_and_emails_the_owner(monkeypatch):
    sent = patch_io(monkeypatch, ext={"X01": "ok", "X02": "falha", "X03": "ok", "X04": "ok", "X05": "ok", "X06": "ok"})
    db = MonthlyDb(prev_rows=rows(C03="atende", C06="atende"))
    answers = {c: "sim" for c in ALL} | {"C06": "nao"}  # backup piorou
    db.cur_answers = answers
    assert process_one(db) is True
    ctrl_alerts = [a for a in db.alerts if a[0]]
    assert [a[0] for a in ctrl_alerts] == ["C06"] and ctrl_alerts[0][1] == "critico"
    assert "avalie com seu corretor" in ctrl_alerts[0][2].lower() or "piorou" in ctrl_alerts[0][2].lower()
    assert any(a[0] is None and "DMARC" in a[2] for a in db.alerts)  # checagem pública também piorou (X02)
    assert db.scans and db.scans[0]["module"] == "externo"
    assert db.uploads == ["o1/m1/mensal.pdf"] and db.report_rows[0]["kind"] == "mensal"
    assert db.completed[0] == "m1" and db.finished == [("j7", "ok", None)]
    assert sent and sent[0][0] == "dono@empresa.com.br"


def test_monthly_job_without_changes_makes_no_alert_and_no_email(monkeypatch):
    sent = patch_io(monkeypatch)
    db = MonthlyDb(prev_rows=rows())
    process_one(db)
    assert db.alerts == [] and sent == []
    assert db.uploads == ["o1/m1/mensal.pdf"]  # o relatório do mês sai mesmo sem piora


def test_monthly_email_escapes_values_in_the_html(monkeypatch):
    # Audit S09: the e-mail body is HTML; nothing from the database goes in unescaped.
    patch_io(monkeypatch)
    bodies = []
    monkeypatch.setattr("app.runner.send_email", lambda to, subject, html, **kw: bodies.append(html) or True)
    db = MonthlyDb(prev_rows=rows(C06="atende"))
    db.cur_answers = {c: "sim" for c in ALL} | {"C06": "nao"}
    db.org_domain = lambda org_id: 'exemplo.com.br"><img src=x onerror=alert(1)>'
    process_one(db)
    assert bodies and "<img" not in bodies[0] and "&lt;img" in bodies[0]
