import asyncio

import pytest

from app.scans.asm import (
    CRITICAL_PORTS,
    ScanNotAuthorized,
    eval_ports,
    probe_port,
    scan_critical_ports,
)
from app.scans.external import eval_dmarc, eval_spf


class _Writer:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True

    async def wait_closed(self):
        return None


def _opener(open_ports=(), refused=(), hang=()):
    async def opener(ip, port):
        if port in hang:
            await asyncio.sleep(10)
        if port in refused:
            raise ConnectionRefusedError
        if port in open_ports:
            return object(), _Writer()
        raise OSError("unreachable")

    return opener


def run(coro):
    return asyncio.run(coro)


def test_critical_ports_are_the_three_high_risk_ones():
    assert CRITICAL_PORTS == {3389: "RDP", 22: "SSH", 445: "SMB"}


def test_probe_open_closed_and_filtered():
    assert run(probe_port("8.8.8.8", 22, 1, _opener(open_ports=(22,)))) == "aberta"
    assert run(probe_port("8.8.8.8", 22, 1, _opener(refused=(22,)))) == "fechada"
    assert run(probe_port("8.8.8.8", 22, 0.05, _opener(hang=(22,)))) == "filtrada"


def test_probe_closes_the_connection_without_sending_data():
    w = _Writer()

    async def opener(ip, port):
        return object(), w

    assert run(probe_port("8.8.8.8", 22, 1, opener)) == "aberta"
    assert w.closed


def test_scan_refuses_without_signed_authorization():
    with pytest.raises(ScanNotAuthorized):
        run(scan_critical_ports("empresa.com.br", authorized=False, resolve=lambda h: ["8.8.8.8"], opener=_opener()))


def test_scan_reports_open_ports():
    r = run(
        scan_critical_ports(
            "empresa.com.br", authorized=True, resolve=lambda h: ["8.8.8.8"], opener=_opener(open_ports=(3389, 445), refused=(22,))
        )
    )
    assert r["ports"] == {"3389": "aberta", "22": "fechada", "445": "aberta"}
    assert r["open"] == [445, 3389]
    assert eval_ports(r) == "falha"


def test_scan_all_closed_is_ok():
    r = run(scan_critical_ports("empresa.com.br", authorized=True, resolve=lambda h: ["8.8.8.8"], opener=_opener(refused=(22, 445, 3389))))
    assert r["open"] == []
    assert eval_ports(r) == "ok"


def test_scan_refuses_private_or_unresolved_targets():
    for resolved in (["10.0.0.5"], ["127.0.0.1"], ["8.8.8.8", "192.168.0.1"], []):
        r = run(scan_critical_ports("empresa.com.br", authorized=True, resolve=lambda h, v=resolved: v, opener=_opener()))
        assert r["ports"] == {}
        assert eval_ports(r) == "sem_dado"


def test_scan_rejects_invalid_host():
    r = run(scan_critical_ports("http://x/../etc", authorized=True, resolve=lambda h: ["8.8.8.8"], opener=_opener()))
    assert r["ports"] == {}


def test_result_has_no_ip_list():
    r = run(scan_critical_ports("empresa.com.br", authorized=True, resolve=lambda h: ["8.8.8.8"], opener=_opener(refused=(22,))))
    assert "8.8.8.8" not in str(r)


# DMARC estrito: só p=reject ou p=quarantine pontuam
def test_dmarc_strict():
    assert eval_dmarc(["v=DMARC1; p=reject; rua=mailto:a@b.com"]) == "ok"
    assert eval_dmarc(["v=DMARC1; p=quarantine"]) == "ok"
    assert eval_dmarc(["v=DMARC1; p=none"]) == "falha"
    assert eval_dmarc(["v=DMARC1; sp=reject; p=none"]) == "falha"  # sp= não conta como p=
    assert eval_dmarc(["v=DMARC1; sp=reject"]) == "falha"  # sem p=
    assert eval_dmarc(["v=DMARC1; p=REJECT"]) == "ok"
    assert eval_dmarc(["v=DMARC1; p=reject", "v=DMARC1; p=none"]) == "falha"  # dois registros é inválido
    assert eval_dmarc([]) == "falha"


def test_spf_unchanged():
    assert eval_spf(["v=spf1 include:x -all"]) == "ok"
    assert eval_spf(["v=spf1 +all"]) == "falha"
