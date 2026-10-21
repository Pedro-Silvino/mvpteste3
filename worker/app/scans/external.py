"""Scan externo (X01-X06 do BASE12.json). Somente consultas públicas: DNS, certificado TLS e
cabeçalhos HTTP da página inicial. Nenhuma varredura de portas."""

import hashlib
import ipaddress
import json
import re
import socket
import ssl
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

import dns.exception
import dns.resolver
import httpx

TIMEOUT = 10  # segundos por checagem (TLS e HTTP)
DNS_TIMEOUT = 3  # consulta DNS: responde rápido ou não responde
BLOCKED_STATUS = (401, 403, 429, 503)  # o site recusou a checagem automática: não prova nada
DKIM_SELECTORS = ["selector1", "selector2", "google", "default", "k1", "s1"]
WEIGHTS = {"X01": 1, "X02": 2, "X03": 1, "X04": 1, "X05": 1, "X06": 1}
VALUE = {"ok": 1.0, "parcial": 0.5, "falha": 0.0}  # sem_dado fica fora do cálculo

_DOMAIN_RE = re.compile(r"^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$")


# ---------------------------------------------------------------- avaliação (funções puras)


def eval_spf(txts: list[str]) -> str:
    for t in txts:
        t = t.strip().lower()
        if t.startswith("v=spf1"):
            return "ok" if t.endswith(("-all", "~all")) else "falha"
    return "falha"


def eval_dmarc(txts: list[str]) -> str:
    for t in txts:
        t = t.strip().lower().replace(" ", "")
        if t.startswith("v=dmarc1"):
            if "p=reject" in t or "p=quarantine" in t:
                return "ok"
            return "parcial"
    return "falha"


def eval_dkim(found: bool) -> str:
    return "ok" if found else "sem_dado"  # não achar seletor comum não prova ausência


def eval_tls(days_left: int | None) -> str:
    if days_left is None or days_left <= 0:
        return "falha"
    return "ok" if days_left > 15 else "parcial"


def eval_https_redirect(final_url: str | None, status: int | None = 200) -> str:
    if status in BLOCKED_STATUS:
        return "sem_dado"  # WAF/bloqueio: não dá para afirmar nem que redireciona nem que não
    return "ok" if final_url and final_url.lower().startswith("https://") else "falha"


def eval_headers(headers: dict[str, str], status: int | None = 200) -> str:
    if status in BLOCKED_STATUS:
        return "sem_dado"  # os cabeçalhos de uma página de bloqueio não são os do site
    return "ok" if any(k.lower() == "strict-transport-security" for k in headers) else "parcial"


def external_score(checks: dict[str, str]) -> int | None:
    total = got = 0.0
    for cid, status in checks.items():
        if status not in VALUE:
            continue
        total += WEIGHTS[cid]
        got += WEIGHTS[cid] * VALUE[status]
    return None if total == 0 else round(100 * got / total)


def build_summary(domain: str, checks: dict[str, str], collected_on: str | None = None) -> dict:
    return {
        "domain": domain,
        "checks": dict(sorted(checks.items())),
        "score": external_score(checks),
        "collected_at": collected_on,  # AAAA-MM-DD, para o relatório dizer quando a checagem foi feita
    }


def canonical_sha256(summary: dict) -> str:
    raw = json.dumps(summary, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------- segurança do alvo


def valid_domain(domain: str) -> bool:
    return bool(_DOMAIN_RE.match(domain))


def is_public_ip(ip: str) -> bool:
    try:
        return ipaddress.ip_address(ip).is_global
    except ValueError:
        return False


# ---------------------------------------------------------------- coleta (rede)


def _resolver() -> dns.resolver.Resolver:
    r = dns.resolver.Resolver()
    r.lifetime = DNS_TIMEOUT
    r.timeout = DNS_TIMEOUT
    return r


def _txt(name: str) -> list[str]:
    try:
        answers = _resolver().resolve(name, "TXT")
    except (dns.exception.DNSException, OSError):
        return []
    return ["".join(p.decode() for p in rr.strings) for rr in answers]


def _has_mx(domain: str) -> bool:
    try:
        _resolver().resolve(domain, "MX")
        return True
    except (dns.exception.DNSException, OSError):
        return False


def _dkim_record_exists(domain: str, selector: str, rtype: str) -> bool:
    try:
        _resolver().resolve(f"{selector}._domainkey.{domain}", rtype)
        return True
    except (dns.exception.DNSException, OSError):
        return False


def _dkim_found(domain: str) -> bool:
    pairs = [(sel, rtype) for sel in DKIM_SELECTORS for rtype in ("TXT", "CNAME")]
    with ThreadPoolExecutor(max_workers=len(pairs)) as pool:
        return any(pool.map(lambda p: _dkim_record_exists(domain, p[0], p[1]), pairs))


def _public_addresses(host: str) -> list[str]:
    """IPs do host; vazio se não resolve ou se algum IP não for público (não aponta o scan para rede interna)."""
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except OSError:
        return []
    ips = list({i[4][0] for i in infos})
    return ips if ips and all(is_public_ip(ip) for ip in ips) else []


def _accepts_tls_port(ip: str) -> bool:
    try:
        with socket.create_connection((ip, 443), timeout=TIMEOUT):
            return True
    except OSError:
        return False


def pick_site_host(domain: str) -> tuple[str, str] | None:
    """Host do site e um IP público dele. Tenta o domínio e depois www.<domínio>, preferindo quem atende na 443.
    None = nenhum dos dois resolve para IP público (sem site para checar)."""
    resolved: list[tuple[str, str]] = []
    for host in (domain, f"www.{domain}"):
        ips = _public_addresses(host)
        if not ips:
            continue
        if _accepts_tls_port(ips[0]):
            return host, ips[0]
        resolved.append((host, ips[0]))
    return resolved[0] if resolved else None


def _tls_days_left(domain: str, ip: str) -> int | None:
    ctx = ssl.create_default_context()
    try:
        with socket.create_connection((ip, 443), timeout=TIMEOUT) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as tls:
                cert = tls.getpeercert()
        return int((ssl.cert_time_to_seconds(cert["notAfter"]) - time.time()) // 86400)
    except (OSError, ssl.SSLError, KeyError, ValueError):
        return None


def _http_get(url: str, max_redirects: int = 0) -> httpx.Response | None:
    """GET sem seguir redirecionamento automático; segue manualmente só até max_redirects saltos."""
    try:
        with httpx.Client(follow_redirects=False, timeout=TIMEOUT, verify=ssl.create_default_context(),
                          headers={"User-Agent": "DataDops-Sentinela/1.0"}) as client:
            r = client.get(url)
            for _ in range(max_redirects):
                loc = r.headers.get("location")
                if r.status_code not in (301, 302, 303, 307, 308) or not loc:
                    break
                r = client.get(str(r.url.join(loc)))
            return r
    except httpx.HTTPError:
        return None


def run_external_scan(domain: str) -> dict[str, str]:
    """Roda X01-X06 e devolve {id: ok|parcial|falha|sem_dado}. As checagens de e-mail e do site andam em paralelo,
    e cada uma é isolada: uma falha vira sem_dado e não derruba as outras."""
    checks: dict[str, str] = {}

    def safe(cid: str, fn: Callable[[], str]) -> None:
        try:
            checks[cid] = fn()
        except Exception:  # noqa: BLE001 - checagem quebrada vira sem_dado, nunca derruba o scan
            checks[cid] = "sem_dado"

    def email_checks() -> None:
        if not _has_mx(domain):  # domínio que não recebe e-mail: SPF/DMARC/DKIM não se aplicam, não é falha
            for cid in ("X01", "X02", "X03"):
                checks[cid] = "sem_dado"
            return
        with ThreadPoolExecutor(max_workers=3) as pool:
            jobs = [
                pool.submit(safe, "X01", lambda: eval_spf(_txt(domain))),
                pool.submit(safe, "X02", lambda: eval_dmarc(_txt(f"_dmarc.{domain}"))),
                pool.submit(safe, "X03", lambda: eval_dkim(_dkim_found(domain))),
            ]
            for j in jobs:
                j.result()

    def site_checks() -> None:
        site = pick_site_host(domain)
        if site is None:
            for cid in ("X04", "X05", "X06"):
                checks[cid] = "sem_dado"
            return
        host, ip = site

        def x05() -> str:
            # http:// deve acabar em https:// (aceita saltos, ex.: http://x -> http://www.x -> https://www.x)
            r = _http_get(f"http://{host}/", max_redirects=3)
            return eval_https_redirect(str(r.url) if r else None, r.status_code if r else None)

        def x06() -> str:
            r = _http_get(f"https://{host}/", max_redirects=3)
            return "sem_dado" if r is None else eval_headers(dict(r.headers), r.status_code)

        with ThreadPoolExecutor(max_workers=3) as pool:
            jobs = [
                pool.submit(safe, "X04", lambda: eval_tls(_tls_days_left(host, ip))),
                pool.submit(safe, "X05", x05),
                pool.submit(safe, "X06", x06),
            ]
            for j in jobs:
                j.result()

    with ThreadPoolExecutor(max_workers=2) as pool:
        for f in [pool.submit(email_checks), pool.submit(site_checks)]:
            f.result()
    return checks
