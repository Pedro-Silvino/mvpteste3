import httpx
import pytest

from app.connectors.m365 import (
    GRAPH_HOST,
    GraphError,
    evaluate_mfa,
    fetch_pages,
    summarize_licenses,
    summarize_mfa,
)

REGS = [
    {"id": "1", "userPrincipalName": "a@x.test", "isAdmin": True, "isMfaRegistered": True},
    {"id": "2", "userPrincipalName": "b@x.test", "isAdmin": True, "isMfaRegistered": False},
    {"id": "3", "userPrincipalName": "c@x.test", "isAdmin": False, "isMfaRegistered": False},
    {"id": "4", "userPrincipalName": "d@x.test", "isAdmin": False, "isMfaRegistered": True},
]


def test_mfa_summary_counts_only():
    s = summarize_mfa(REGS)
    assert s == {"admins_total": 2, "admins_without_mfa": 1, "users_total": 4, "users_without_mfa": 2}
    assert "x.test" not in str(s)


def test_mfa_evaluation():
    assert evaluate_mfa(summarize_mfa(REGS)) == "falha"
    ok = [dict(r, isMfaRegistered=True) for r in REGS]
    assert evaluate_mfa(summarize_mfa(ok)) == "ok"
    partial = [dict(r, isMfaRegistered=r["isAdmin"]) for r in REGS]
    assert evaluate_mfa(summarize_mfa(partial)) == "parcial"
    assert evaluate_mfa(summarize_mfa([])) == "sem_dado"
    only_users = [r for r in REGS if not r["isAdmin"]]
    assert evaluate_mfa(summarize_mfa(only_users)) == "sem_dado"


def test_mfa_ignores_malformed_rows():
    s = summarize_mfa([{"isAdmin": "x"}, "lixo", None, {"isAdmin": True, "isMfaRegistered": True}])
    assert s["admins_total"] == 1 and s["users_total"] == 1


SKUS = [
    {"skuPartNumber": "SPE_E5", "consumedUnits": 10, "prepaidUnits": {"enabled": 12}},
    {"skuPartNumber": "AAD_PREMIUM_P1", "consumedUnits": 0, "prepaidUnits": {"enabled": 0}},
    {"skuPartNumber": "POWER_BI_PRO", "consumedUnits": 3, "prepaidUnits": {"enabled": 5}},
]


def test_license_summary():
    s = summarize_licenses(SKUS)
    assert s["security_skus_active"] == 1
    assert s["has_identity_protection"] is True
    assert s["licenses_consumed"] == 13
    assert "POWER_BI_PRO" not in str(s)


def test_license_summary_empty():
    s = summarize_licenses([])
    assert s["security_skus_active"] == 0 and s["has_identity_protection"] is False


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_fetch_pages_follows_next_link_with_bearer():
    seen = []

    def handler(req: httpx.Request):
        seen.append((str(req.url), req.headers.get("authorization")))
        if "page2" in str(req.url):
            return httpx.Response(200, json={"value": [{"id": "2"}]})
        return httpx.Response(200, json={"value": [{"id": "1"}], "@odata.nextLink": f"https://{GRAPH_HOST}/v1.0/x?page2"})

    rows = fetch_pages("tok", "/reports/authenticationMethods/userRegistrationDetails", client=_client(handler))
    assert [r["id"] for r in rows] == ["1", "2"]
    assert all(a == "Bearer tok" for _, a in seen)


def test_fetch_pages_refuses_foreign_next_link():
    def handler(req):
        return httpx.Response(200, json={"value": [], "@odata.nextLink": "https://evil.example/steal"})

    with pytest.raises(GraphError):
        fetch_pages("tok", "/subscribedSkus", client=_client(handler))


def test_fetch_pages_error_does_not_leak_token():
    def handler(req):
        return httpx.Response(403, json={"error": {"message": "tok secret"}})

    with pytest.raises(GraphError) as e:
        fetch_pages("tok-secret-123", "/subscribedSkus", client=_client(handler))
    assert "tok-secret-123" not in str(e.value) and "403" in str(e.value)


def test_fetch_pages_caps_pages():
    def handler(req):
        return httpx.Response(200, json={"value": [{"id": "1"}], "@odata.nextLink": f"https://{GRAPH_HOST}/v1.0/x"})

    assert len(fetch_pages("t", "/x", client=_client(handler), max_pages=3)) == 3
