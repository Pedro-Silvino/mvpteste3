import json

import httpx

from app.notifications.webhooks import (
    Alert,
    build_slack,
    build_teams,
    detect_alerts,
    dispatch,
    validate_target,
)

SLACK = "https://hooks.slack.com/services/T000/B000/XXXX"
TEAMS = "https://contoso.webhook.office.com/webhookb2/abc/IncomingWebhook/def/ghi"


def test_detect_open_port_alert():
    a = detect_alerts("empresa.com.br", {"open": [3389, 22]}, {}, None)
    assert [x.kind for x in a] == ["porta_critica"]
    assert "RDP" in a[0].detail and "SSH" in a[0].detail


def test_detect_no_alert_when_closed_and_healthy():
    assert detect_alerts("empresa.com.br", {"open": []}, {"X01": "ok", "X02": "ok"}, {"X01": "ok", "X02": "ok"}) == []


def test_detect_spf_dmarc_break_only_on_regression_or_first_failure():
    prev = {"X01": "ok", "X02": "ok"}
    cur = {"X01": "falha", "X02": "ok"}
    assert [x.kind for x in detect_alerts("e.com.br", None, cur, prev)] == ["spf_quebrado"]
    assert [x.kind for x in detect_alerts("e.com.br", None, {"X02": "falha"}, prev)] == ["dmarc_quebrado"]
    assert detect_alerts("e.com.br", None, {"X02": "falha"}, {"X02": "falha"}) == []  # já estava assim: sem repetir
    assert [x.kind for x in detect_alerts("e.com.br", None, {"X02": "falha"}, None)] == ["dmarc_quebrado"]


def test_payload_formats_and_content():
    a = Alert(kind="porta_critica", domain="empresa.com.br", detail="RDP (3389)")
    s = build_slack(a)
    t = build_teams(a)
    assert "empresa.com.br" in s["text"] and "RDP" in s["text"]
    assert t["@type"] == "MessageCard" and "empresa.com.br" in json.dumps(t)
    for banned in ("100% seguro", "empresa segura", "risco zero", "certificad"):
        assert banned not in json.dumps(s, ensure_ascii=False).lower()


def test_validate_target():
    assert validate_target({"type": "slack", "url": SLACK})
    assert validate_target({"type": "teams", "url": TEAMS})
    assert validate_target({"type": "email", "to": "ti@empresa.com.br"})
    assert not validate_target({"type": "slack", "url": "http://hooks.slack.com/services/x"})  # sem https
    assert not validate_target({"type": "slack", "url": "https://evil.example/services/x"})
    assert not validate_target({"type": "slack", "url": "https://hooks.slack.com.evil.example/x"})
    assert not validate_target({"type": "teams", "url": "https://127.0.0.1/x"})
    assert not validate_target({"type": "email", "to": "sem-arroba"})
    assert not validate_target({"type": "sms", "to": "1"})


def test_dispatch_sends_to_each_valid_target_and_never_raises():
    calls = []

    def handler(req: httpx.Request):
        calls.append(str(req.url))
        return httpx.Response(200 if "slack" in str(req.url) else 500)

    sent_mail = []
    targets = [
        {"type": "slack", "url": SLACK},
        {"type": "teams", "url": TEAMS},
        {"type": "slack", "url": "https://evil.example/x"},
        {"type": "email", "to": "ti@empresa.com.br"},
    ]
    res = dispatch(
        Alert(kind="spf_quebrado", domain="empresa.com.br", detail="SPF"),
        targets,
        transport=httpx.MockTransport(handler),
        mailer=lambda to, subject, html: sent_mail.append((to, subject)) or True,
    )
    assert res == {"enviados": 2, "falhas": 1, "ignorados": 1}
    assert len(calls) == 2 and sent_mail[0][0] == "ti@empresa.com.br"


def test_dispatch_survives_network_error():
    def handler(req):
        raise httpx.ConnectError("boom")

    res = dispatch(
        Alert(kind="dmarc_quebrado", domain="e.com.br", detail="DMARC"),
        [{"type": "slack", "url": SLACK}],
        transport=httpx.MockTransport(handler),
    )
    assert res["falhas"] == 1
