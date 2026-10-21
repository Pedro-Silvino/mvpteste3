from app.scans.external import (
    build_summary,
    canonical_sha256,
    eval_dkim,
    eval_dmarc,
    eval_headers,
    eval_https_redirect,
    eval_spf,
    eval_tls,
    external_score,
    is_public_ip,
    valid_domain,
)


def test_spf():
    assert eval_spf(["v=spf1 include:_spf.google.com -all"]) == "ok"
    assert eval_spf(["v=spf1 include:x ~all"]) == "ok"
    assert eval_spf(["v=spf1 +all"]) == "falha"
    assert eval_spf(["v=spf1 include:x ?all"]) == "falha"
    assert eval_spf([]) == "falha"
    assert eval_spf(["google-site-verification=abc"]) == "falha"


def test_dmarc():
    assert eval_dmarc(["v=DMARC1; p=reject; rua=mailto:a@b.com"]) == "ok"
    assert eval_dmarc(["v=DMARC1; p=quarantine"]) == "ok"
    assert eval_dmarc(["v=DMARC1; p=none"]) == "parcial"
    assert eval_dmarc([]) == "falha"


def test_dkim_missing_is_no_data_not_failure():
    assert eval_dkim(True) == "ok"
    assert eval_dkim(False) == "sem_dado"


def test_tls():
    assert eval_tls(days_left=90) == "ok"
    assert eval_tls(days_left=15) == "parcial"
    assert eval_tls(days_left=3) == "parcial"
    assert eval_tls(days_left=0) == "falha"
    assert eval_tls(days_left=None) == "falha"  # invalid / unreachable


def test_https_redirect():
    assert eval_https_redirect("https://exemplo.com.br/") == "ok"
    assert eval_https_redirect("http://exemplo.com.br/x") == "falha"
    assert eval_https_redirect(None, None) == "falha"  # porta 80 sem resposta


def test_blocked_site_is_no_data_not_failure():
    for status in (401, 403, 429, 503):
        assert eval_https_redirect("http://exemplo.com.br/", status) == "sem_dado"
        assert eval_headers({"server": "waf"}, status) == "sem_dado"


def test_headers():
    assert eval_headers({"Strict-Transport-Security": "max-age=31536000"}) == "ok"
    assert eval_headers({"server": "nginx"}) == "parcial"


def test_score_uses_weights_and_skips_no_data():
    # X01 w1 ok, X02 w2 falha, X03 sem_dado (ignored): 100 * 1 / 3 = 33
    assert external_score({"X01": "ok", "X02": "falha", "X03": "sem_dado"}) == 33
    assert external_score({"X02": "parcial"}) == 50
    assert external_score({"X03": "sem_dado"}) is None
    assert external_score({k: "ok" for k in ["X01", "X02", "X03", "X04", "X05", "X06"]}) == 100


def test_summary_is_canonical_and_hash_stable():
    s1 = build_summary("exemplo.com.br", {"X01": "ok", "X02": "falha"}, "2026-10-21")
    s2 = build_summary("exemplo.com.br", {"X02": "falha", "X01": "ok"}, "2026-10-21")
    assert canonical_sha256(s1) == canonical_sha256(s2)
    assert len(canonical_sha256(s1)) == 64
    assert s1["checks"]["X02"] == "falha"
    # No lists of people, only statuses.
    assert set(s1) == {"domain", "checks", "score", "collected_at"}


def test_valid_domain():
    assert valid_domain("exemplo.com.br")
    for bad in ["localhost", "10.0.0.1", "a b.com", "exemplo", "http://x.com", "x.com/a", ""]:
        assert not valid_domain(bad), bad


def test_ssrf_guard():
    for ip in ["127.0.0.1", "10.1.2.3", "192.168.0.5", "169.254.169.254", "172.16.0.1", "::1", "0.0.0.0", "fc00::1"]:
        assert not is_public_ip(ip), ip
    assert is_public_ip("8.8.8.8")


def test_no_mx_means_email_checks_do_not_apply(monkeypatch):
    import app.scans.external as ext

    monkeypatch.setattr(ext, "_has_mx", lambda d: False)
    monkeypatch.setattr(ext, "pick_site_host", lambda d: None)
    assert ext.run_external_scan("exemplo.com.br") == {
        "X01": "sem_dado", "X02": "sem_dado", "X03": "sem_dado",
        "X04": "sem_dado", "X05": "sem_dado", "X06": "sem_dado",
    }


def test_site_host_falls_back_to_www(monkeypatch):
    import app.scans.external as ext

    monkeypatch.setattr(ext, "_public_addresses", lambda h: ["8.8.8.8"] if h.startswith("www.") else [])
    monkeypatch.setattr(ext, "_accepts_tls_port", lambda ip: True)
    assert ext.pick_site_host("exemplo.com.br") == ("www.exemplo.com.br", "8.8.8.8")


def test_site_host_none_when_nothing_resolves_publicly(monkeypatch):
    import app.scans.external as ext

    monkeypatch.setattr(ext, "_public_addresses", lambda h: [])
    assert ext.pick_site_host("exemplo.com.br") is None


def test_dkim_is_searched_in_parallel_and_stops_being_slow(monkeypatch):
    import time

    import app.scans.external as ext

    def slow(domain, selector, rtype):
        time.sleep(0.3)
        return selector == "k1" and rtype == "CNAME"

    monkeypatch.setattr(ext, "_dkim_record_exists", slow)
    start = time.time()
    assert ext._dkim_found("exemplo.com.br") is True
    assert time.time() - start < 1.0  # 12 consultas x 0.3 s em série seriam 3,6 s
