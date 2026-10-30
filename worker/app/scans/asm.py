"""ASM: verificação não intrusiva de portas críticas (RDP 3389, SSH 22, SMB 445).

Só abre e fecha a conexão TCP: nenhum dado é enviado nem lido. Exige autorização assinada
(`authorizations.kind = 'scan_ativo'`, CLAUDE.md §4.10): sem ela, levanta ScanNotAuthorized.
O alvo precisa ter só IPs públicos; o resultado guarda a situação por porta, nunca os IPs."""

import asyncio
import socket
from collections.abc import Awaitable, Callable

from app.scans.external import is_public_ip, valid_domain

CRITICAL_PORTS = {3389: "RDP", 22: "SSH", 445: "SMB"}
PORT_TIMEOUT = 3.0  # segundos por porta: sem resposta é tratado como filtrada
MAX_CONCURRENCY = 6

Opener = Callable[[str, int], Awaitable[tuple]]


class ScanNotAuthorized(Exception):
    """Varredura de portas pedida sem autorização assinada (scan_ativo)."""


def _resolve(host: str) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except OSError:
        return []
    return sorted({i[4][0] for i in infos})


async def probe_port(ip: str, port: int, timeout: float = PORT_TIMEOUT, opener: Opener = asyncio.open_connection) -> str:
    """'aberta' (conectou), 'fechada' (recusou) ou 'filtrada' (sem resposta no prazo ou inalcançável)."""
    try:
        _, writer = await asyncio.wait_for(opener(ip, port), timeout)
    except ConnectionRefusedError:
        return "fechada"
    except (TimeoutError, OSError):
        return "filtrada"
    writer.close()
    try:
        await asyncio.wait_for(writer.wait_closed(), 1)
    except (TimeoutError, OSError):
        pass
    return "aberta"


async def scan_critical_ports(
    host: str,
    *,
    authorized: bool,
    resolve: Callable[[str], list[str]] = _resolve,
    opener: Opener = asyncio.open_connection,
    timeout: float = PORT_TIMEOUT,
) -> dict:
    if not authorized:
        raise ScanNotAuthorized("varredura de portas exige autorização assinada (scan_ativo)")
    empty = {"ports": {}, "open": []}
    if not valid_domain(host):
        return empty
    ips = resolve(host)
    if not ips or not all(is_public_ip(ip) for ip in ips):  # nunca aponta para rede interna
        return empty
    ip = ips[0]
    sem = asyncio.Semaphore(MAX_CONCURRENCY)

    async def one(port: int) -> tuple[int, str]:
        async with sem:
            return port, await probe_port(ip, port, timeout, opener)

    results = dict(await asyncio.gather(*(one(p) for p in CRITICAL_PORTS)))
    return {
        "ports": {str(p): results[p] for p in CRITICAL_PORTS},
        "open": sorted(p for p, s in results.items() if s == "aberta"),
    }


def eval_ports(result: dict) -> str:
    if not result.get("ports"):
        return "sem_dado"
    return "falha" if result["open"] else "ok"
