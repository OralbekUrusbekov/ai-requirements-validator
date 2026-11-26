from pathlib import Path
import time

from fastapi.testclient import TestClient

from webapp.app import create_app


def make_client(tmp_path: Path, monkeypatch) -> TestClient:
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    monkeypatch.setenv("LLM_CACHE", "off")
    return TestClient(create_app(tmp_path / "runs"))


def wait_for_run(client: TestClient, run_id: str) -> dict:
    for _ in range(100):
        response = client.get(f"/api/runs/{run_id}")
        assert response.status_code == 200
        status = response.json()
        if status["status"] in {"done", "error"}:
            return status
        time.sleep(0.02)
    raise AssertionError("Запуск не завершился вовремя")


def test_upload_poll_and_fetch_report(tmp_path: Path, monkeypatch) -> None:
    with make_client(tmp_path, monkeypatch) as client:
        response = client.post(
            "/api/runs",
            files={"file": ("requirements.md", "# Сервис\n* Сервис сохраняет настройку пользователя.\n", "text/markdown")},
            data={"provider": "mock"},
        )
        assert response.status_code == 202
        run_id = response.json()["run_id"]

        status = wait_for_run(client, run_id)
        assert status["status"] == "done", status.get("error")
        report = client.get(f"/api/runs/{run_id}/report")
        assert report.status_code == 200
        payload = report.json()
        assert payload["metadata"]["agent_version"]
        assert payload["summary"]["requirement_count"] == 1
        assert client.get(f"/api/runs/{run_id}/report.md").status_code == 200
        assert client.get(f"/api/runs/{run_id}/report.json").status_code == 200


def test_invalid_extension_is_rejected(tmp_path: Path, monkeypatch) -> None:
    with make_client(tmp_path, monkeypatch) as client:
        response = client.post(
            "/api/runs", files={"file": ("requirements.exe", b"no", "application/octet-stream")}
        )
    assert response.status_code == 400


def test_config_never_exposes_api_key(tmp_path: Path, monkeypatch) -> None:
    secret = "definitely-private-test-key"
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", secret)
    monkeypatch.setenv("GEMINI_MODEL", "gemini-test")
    with TestClient(create_app(tmp_path / "runs")) as client:
        response = client.get("/api/config")

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "provider": "gemini", "model": "gemini-test", "batch_size": 12,
        "api_key_configured": True,
    }
    assert secret not in response.text


def test_upload_with_context_tests_and_html(tmp_path: Path, monkeypatch) -> None:
    with make_client(tmp_path, monkeypatch) as client:
        response = client.post(
            "/api/runs",
            files=[
                ("file", ("requirements.md", "# Каталог\n- Система сохраняет настройку пользователя.\n", "text/markdown")),
                ("context", ("passport.md", "# Паспорт\nЦель проекта — хранить настройку пользователя.\n", "text/markdown")),
            ],
            data={"provider": "mock", "generate_tests": "true", "report_format": "html"},
        )
        assert response.status_code == 202
        run_id = response.json()["run_id"]
        status = wait_for_run(client, run_id)
        assert status["status"] == "done", status.get("error")
        assert status["context_used"] is True
        report = client.get(f"/api/runs/{run_id}/report").json()
        assert report["context"]["used"] is True
        assert report["test_cases"]
        assert client.get(f"/api/runs/{run_id}/files/report.html").status_code == 200
