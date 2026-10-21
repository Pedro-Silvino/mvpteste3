"""O script agent/sentinela-agent.ps1 e o validador do worker precisam falar a mesma língua."""

import json
import re
from pathlib import Path

from app.ingest import IngestPayload, WindowsMachine

AGENT = Path(__file__).resolve().parents[2] / "agent" / "sentinela-agent.ps1"

# Saída real do coletor em -DryRun (código da máquina trocado por um valor fictício).
SAMPLE = {
    "module": "windows",
    "collector_version": "1.0.0",
    "collected_at": "2026-10-21T18:07:05.9278774Z",
    "device_ref": "c" * 64,
    "summary": {
        "machine": {
            "os_supported": True,
            "last_update_days": 7,
            "av_active": True,
            "av_age_days": 0,
            "user_is_local_admin": False,
            "is_laptop": True,
            "bitlocker": None,
        }
    },
}


def test_real_collector_output_is_accepted_by_the_worker_model():
    parsed = IngestPayload.model_validate(SAMPLE)
    assert parsed.summary["machine"]["bitlocker"] is None


def test_script_builds_exactly_the_fields_the_worker_accepts():
    text = AGENT.read_text(encoding="utf-8-sig")
    block = re.search(r"machine = \[ordered\]@\{(.*?)\n        \}", text, re.S).group(1)
    sent = set(re.findall(r"^\s*(\w+)\s*=", block, re.M))
    assert sent == set(WindowsMachine.model_fields)


def test_script_never_sends_the_computer_name_or_user_name_in_clear():
    text = AGENT.read_text(encoding="utf-8-sig")
    envelope = re.search(r"\$payload = \[ordered\]@\{(.*?)\n\}\n", text, re.S).group(1)
    assert "MachineName" in envelope and "Get-Sha256Hex" in envelope  # só o hash do nome
    for forbidden in ("UserName", "USERNAME", "env:COMPUTERNAME", "Get-LocalUser", "Get-LocalGroupMember"):
        assert forbidden not in text, forbidden


def test_script_has_a_dry_run_and_requires_https():
    text = AGENT.read_text(encoding="utf-8-sig")
    assert "[switch]$DryRun" in text and "^https://" in text and "snt_[a-f0-9]{64}" in text


def test_script_starts_with_a_bom_so_windows_powershell_reads_accents(tmp_path):
    assert AGENT.read_bytes()[:3] == b"\xef\xbb\xbf"
