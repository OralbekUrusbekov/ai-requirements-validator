from __future__ import annotations

from pathlib import Path
import time

from fastapi.testclient import TestClient

from webapp.app import create_app


def platform_client(tmp_path: Path, monkeypatch) -> TestClient:
    monkeypatch.setenv("APP_DB", str(tmp_path / "data" / "app.db"))
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    monkeypatch.setenv("LLM_CACHE", "off")
    return TestClient(create_app(tmp_path / "runs"))


def wait_done(client: TestClient, run_id: str) -> dict:
    for _ in range(300):
        value = client.get(f"/api/runs/{run_id}").json()
        if value["status"] in {"done", "error"}:
            return value
        time.sleep(0.02)
    raise AssertionError("platform run timeout")


def test_project_crud_documents_versions_and_settings(tmp_path: Path, monkeypatch) -> None:
    with platform_client(tmp_path, monkeypatch) as client:
        created = client.post("/api/projects", json={
            "key": "TEST", "name": "Тестовый проект", "description": "Описание", "owner": "Анна",
        })
        assert created.status_code == 201
        assert client.get("/api/projects/TEST").json()["name"] == "Тестовый проект"
        document = client.post(
            "/api/projects/TEST/documents", files={"file": ("r.md", "# R\n- Система хранит значение.\n", "text/markdown")}
        ).json()
        updated = client.post(
            "/api/projects/TEST/documents", data={"document_id": document["id"]},
            files={"file": ("r.md", "# R\n- Система удаляет значение.\n", "text/markdown")},
        ).json()
        assert [item["version"] for item in updated["versions"]] == [2, 1]
        text = client.get(f"/api/documents/{document['id']}/versions/2/text").json()
        assert "удаляет" in text["text"]
        assert client.patch("/api/projects/TEST", json={"description": "Новое"}).json()["description"] == "Новое"
        assert client.delete("/api/projects/TEST").status_code == 204


def test_runs_defect_lifecycle_comments_bulk_filters_dashboard_search(tmp_path: Path, monkeypatch) -> None:
    with platform_client(tmp_path, monkeypatch) as client:
        client.post("/api/projects", json={"key": "QA", "name": "QA", "owner": "Анна"})
        document = client.post(
            "/api/projects/QA/documents",
            files={"file": ("requirements.md", "# Каталог\n- Система хранит настройку пользователя.\n- Система журналирует изменение настройки.\n", "text/markdown")},
        ).json()
        first_version = document["versions"][0]["id"]
        first = client.post("/api/projects/QA/runs", json={
            "document_version_id": first_version, "provider": "mock", "model": "mock-deterministic",
            "use_context": False, "tests": False, "domain_check": False, "batch_size": 1,
        }).json()
        assert wait_done(client, first["id"])["status"] == "done"
        defects = client.get("/api/projects/QA/defects").json()["items"]
        assert len(defects) == 2 and defects[0]["key"].startswith("QA-")
        defect_key = "QA-1"
        assert client.patch(f"/api/defects/{defect_key}", json={"assignee": "Анна", "status": "in_progress"}).status_code == 200
        assert client.post(f"/api/defects/{defect_key}/comments", json={"text": "Проверить формулировку"}).status_code == 201
        assert client.get(f"/api/defects/{defect_key}/comments").json()
        assert client.get(f"/api/defects/{defect_key}/history").json()
        assert client.post("/api/defects/bulk", json={"keys": [defect_key], "status": "open"}).status_code == 200
        assert client.patch(f"/api/defects/{defect_key}", json={"status": "fixed"}).status_code == 200
        saved = client.post("/api/projects/QA/filters", json={"name": "Открытые", "query": {"status": "open"}}).json()
        assert client.get("/api/projects/QA/filters").json()[0]["name"] == "Открытые"
        assert client.delete(f"/api/projects/QA/filters/{saved['id']}").status_code == 204

        updated = client.post(
            "/api/projects/QA/documents", data={"document_id": document["id"]},
            files={"file": ("requirements.md", "# Каталог\n- Система хранит настройку пользователя.\n", "text/markdown")},
        ).json()
        second = client.post("/api/projects/QA/runs", json={
            "document_version_id": updated["versions"][0]["id"], "provider": "mock",
            "use_context": False, "domain_check": False, "batch_size": 1,
        }).json()
        assert wait_done(client, second["id"])["status"] == "done"
        all_defects = client.get("/api/projects/QA/defects?page_size=100").json()["items"]
        by_key = {item["key"]: item for item in all_defects}
        assert len(by_key) == 2
        assert by_key["QA-1"]["status"] == "open"
        assert by_key["QA-2"]["status"] == "fixed"
        assert any("Найден снова" in item["action"] for item in client.get("/api/defects/QA-1/history").json())
        assert any("Переоткрыт" in item["action"] for item in client.get("/api/defects/QA-1/history").json())
        assert any("Не найден" in item["action"] for item in client.get("/api/defects/QA-2/history").json())
        dashboard = client.get("/api/projects/QA/dashboard").json()
        assert dashboard["kpis"]["open_defects"] == 1
        assert client.get("/api/search?q=QA-2").json()["defects"][0]["key"] == "QA-2"
        assert client.get(f"/api/runs/{second['id']}/report").status_code == 200


def test_spa_fallback_when_build_exists(tmp_path: Path, monkeypatch) -> None:
    import webapp.app as app_module

    root = tmp_path / "root"
    (root / "frontend" / "dist").mkdir(parents=True)
    (root / "frontend" / "dist" / "index.html").write_text("<h1>SPA</h1>", encoding="utf-8")
    monkeypatch.setattr(app_module, "PROJECT_ROOT", root)
    monkeypatch.setenv("APP_DB", str(tmp_path / "app.db"))
    with TestClient(app_module.create_app(tmp_path / "runs")) as client:
        response = client.get("/projects/CARD/defects")
    assert response.status_code == 200
    assert "SPA" in response.text
