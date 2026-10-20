import os

from app.db import load_env
from app.runner import run_forever


def test_load_env_accepts_bom_crlf_export_and_quotes(tmp_path, monkeypatch):
    monkeypatch.delenv("SNT_A", raising=False)
    monkeypatch.delenv("SNT_B", raising=False)
    f = tmp_path / ".env"
    f.write_bytes("\ufeff# comentario\r\nSNT_A = valor1 \r\nexport SNT_B=\"valor2\"\r\n".encode("utf-8"))
    status = load_env(f)
    assert os.environ["SNT_A"] == "valor1"
    assert os.environ["SNT_B"] == "valor2"
    assert status["found"] is True


def test_load_env_missing_file_reports_not_found(tmp_path):
    assert load_env(tmp_path / "nope.env")["found"] is False


class FlakyDb:
    def __init__(self):
        self.calls = 0

    def claim_job(self):
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("network down")
        raise KeyboardInterrupt  # ends the test loop on the second pass


def test_loop_survives_a_failed_poll(monkeypatch):
    monkeypatch.setattr("app.runner.time.sleep", lambda s: None)
    db = FlakyDb()
    try:
        run_forever(db, idle_seconds=0)
    except KeyboardInterrupt:
        pass
    assert db.calls == 2  # first call failed, loop kept going
