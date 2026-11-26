from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import csv
from datetime import datetime
import hashlib
import io
import json
from pathlib import Path
import re
import sqlite3
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import PlainTextResponse, Response

from validator.config import load_config
from validator.formats import write_artifacts
from validator.llm import mask_secrets
from validator.loader import load_document
from validator.pipeline import run_pipeline
from validator.verifier import normalize

from .db import Repository, now_iso


ALLOWED_EXTENSIONS = {".pdf", ".docx", ".md", ".txt"}
MAX_UPLOAD = 10 * 1024 * 1024
CONTEXT_TYPES = {"passport", "glossary", "systems", "policies", "other"}


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _loads(value: str | None, default: Any) -> Any:
    try:
        return json.loads(value or "")
    except (json.JSONDecodeError, TypeError):
        return default


def _duration(run: dict[str, Any]) -> int | None:
    if not run.get("started_at") or not run.get("finished_at"):
        return None
    try:
        return round((datetime.fromisoformat(run["finished_at"]) - datetime.fromisoformat(run["started_at"])).total_seconds())
    except ValueError:
        return None


class PlatformService:
    def __init__(self, repository: Repository):
        self.repo = repository
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="platform-runs")

    def submit(self, run_id: str) -> None:
        self.executor.submit(self._execute, run_id)

    def _execute(self, run_id: str) -> None:
        run = self.repo.run(run_id)
        if not run:
            return
        try:
            self.repo.update_run(run_id, status="running", step="Загрузка", progress=2, started_at=now_iso())
            options = run["options"]
            settings = load_config(
                run["provider"], run["model"], options.get("batch_size"),
                options.get("cache", True),
            )
            context_paths = None
            if options.get("use_context"):
                context_paths = [item["path"] for item in self.repo.context_files(run["project_key"])]
            report_dir = self.repo.storage_root / run["project_key"] / "runs" / str(run["number"])
            report_dir.mkdir(parents=True, exist_ok=True)

            def progress(event: dict[str, Any]) -> None:
                self.repo.update_run(
                    run_id, step=event.get("label", "Проверка"), progress=int(event.get("progress", 0))
                )

            result = run_pipeline(
                run["document_path"], str(report_dir / "report.md"), settings,
                progress_callback=progress, context_paths=context_paths,
                domain_check=bool(options.get("domain_check", True)),
                generate_tests=bool(options.get("tests", False)),
            )
            markdown = result.report_path.read_text(encoding="utf-8")
            write_artifacts(report_dir / "report.html", markdown, result.payload)
            write_artifacts(report_dir / "report.docx", markdown, result.payload)
            defect_map = self.sync_defects(run, result.payload)
            self._attach_defect_keys(result.payload, defect_map)
            (report_dir / "report.json").write_text(
                json.dumps(result.payload, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            summary = result.payload["summary"]
            metadata = result.payload["metadata"]
            self.repo.update_run(
                run_id, status="done", step="Отчёт", progress=100, finished_at=now_iso(), error=None,
                agent_version=metadata.get("agent_version"), requirements_count=summary["requirement_count"],
                findings_count=summary["finding_count"], coverage=metadata.get("coverage_percent"),
                decision=summary.get("decision"), report_dir=str(report_dir),
            )
        except Exception as error:
            settings = load_config(run["provider"], run["model"])
            message = mask_secrets(
                " ".join(str(error).split()),
                tuple(filter(None, (settings.gemini_api_key, settings.openai_api_key))),
            )
            self.repo.update_run(
                run_id, status="error", step="Ошибка", finished_at=now_iso(),
                error=f"Не удалось выполнить проверку: {message[:500]}",
            )

    @staticmethod
    def _finding_records(payload: dict[str, Any]) -> list[tuple[dict[str, Any], str]]:
        result: list[tuple[dict[str, Any], str]] = []
        for check in payload.get("requirement_checks", []):
            for finding in check.get("findings", []):
                result.append((finding, "domain" if finding.get("expert_confirmation") else "internal"))
        for finding in payload.get("set_check", {}).get("findings", []):
            result.append((finding, "domain" if finding.get("expert_confirmation") else "internal"))
        for finding in payload.get("context", {}).get("findings", []):
            converted = {
                "criterion": finding.get("type", "context"), "severity": finding.get("severity", "major"),
                "quote": finding.get("requirement_quote", ""),
                "related_quotes": [finding.get("context_quote", "")],
                "requirement_ids": finding.get("requirement_ids", []),
                "location": f"строка {finding.get('requirement_line') or '—'}",
                "explanation": finding.get("explanation", ""), "fix": finding.get("fix", ""),
            }
            result.append((converted, "context"))
        return result

    def sync_defects(self, run: dict[str, Any], payload: dict[str, Any]) -> dict[str, str]:
        seen: set[str] = set()
        mapping: dict[str, str] = {}
        timestamp = now_iso()
        for finding, finding_type in self._finding_records(payload):
            fingerprint = hashlib.sha256(
                f"{finding.get('criterion', '')}|{normalize(str(finding.get('quote', '')))}".encode()
            ).hexdigest()
            seen.add(fingerprint)
            existing = self.repo.one(
                "SELECT * FROM defects WHERE project_key=? AND fingerprint=?",
                (run["project_key"], fingerprint),
            )
            if existing:
                status = existing["status"]
                if status == "fixed":
                    status = "open"
                    self.repo.add_history(existing["key"], "Агент", "Переоткрыт", f"Прогон #{run['number']}")
                self.repo.execute(
                    """UPDATE defects SET title=?,severity=?,criterion=?,type=?,status=?,requirement_ids_json=?,
                    quotes_json=?,location=?,explanation=?,fix=?,last_seen_run_id=?,updated_at=? WHERE key=?""",
                    (self._title(finding), finding.get("severity", "major"), finding.get("criterion", "complete"),
                     finding_type, status, _json(finding.get("requirement_ids", [])),
                     _json([finding.get("quote", ""), *finding.get("related_quotes", [])]),
                     finding.get("location", ""), finding.get("explanation", ""), finding.get("fix", ""),
                     run["id"], timestamp, existing["key"]),
                )
                self.repo.add_history(existing["key"], "Агент", f"Найден снова в прогоне #{run['number']}")
                mapping[fingerprint] = existing["key"]
                continue
            number_row = self.repo.one(
                "SELECT COALESCE(MAX(number),0)+1 AS number FROM defects WHERE project_key=?", (run["project_key"],)
            )
            number = int(number_row["number"] if number_row else 1)
            key = f"{run['project_key']}-{number}"
            self.repo.execute(
                """INSERT INTO defects VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (key, run["project_key"], number, fingerprint, self._title(finding),
                 finding.get("severity", "major"), finding.get("criterion", "complete"), finding_type,
                 "open", None, _json(finding.get("requirement_ids", [])),
                 _json([finding.get("quote", ""), *finding.get("related_quotes", [])]),
                 finding.get("location", ""), finding.get("explanation", ""), finding.get("fix", ""),
                 run["id"], run["id"], None, timestamp, timestamp),
            )
            self.repo.add_history(key, "Агент", "Создан", f"Прогон #{run['number']}")
            mapping[fingerprint] = key
        active = self.repo.all(
            "SELECT * FROM defects WHERE project_key=? AND status IN ('open','in_progress')",
            (run["project_key"],),
        )
        for defect in active:
            if defect["fingerprint"] not in seen:
                self.repo.execute(
                    "UPDATE defects SET status='fixed',updated_at=? WHERE key=?", (timestamp, defect["key"])
                )
                self.repo.add_history(
                    defect["key"], "Агент", f"Не найден в прогоне #{run['number']}", "Статус изменён на исправлен"
                )
        return mapping

    @staticmethod
    def _title(finding: dict[str, Any]) -> str:
        explanation = re.split(r"(?<=[.!?])\s+", str(finding.get("explanation", "Дефект требования")))[0]
        return explanation[:60].rstrip() or "Дефект требования"

    @staticmethod
    def _attach_defect_keys(payload: dict[str, Any], mapping: dict[str, str]) -> None:
        for finding, _ in PlatformService._finding_records(payload):
            fingerprint = hashlib.sha256(
                f"{finding.get('criterion', '')}|{normalize(str(finding.get('quote', '')))}".encode()
            ).hexdigest()
            finding["defect_key"] = mapping.get(fingerprint)

    def run_payload(self, run_id: str) -> dict[str, Any]:
        run = self.repo.run(run_id)
        if not run:
            raise KeyError(run_id)
        if not run.get("report_dir"):
            raise FileNotFoundError(run_id)
        return json.loads((Path(run["report_dir"]) / "report.json").read_text(encoding="utf-8"))


def serialize_run(run: dict[str, Any]) -> dict[str, Any]:
    return {**run, "duration": _duration(run)}


def defect_dict(value: dict[str, Any], repo: Repository) -> dict[str, Any]:
    requirement_ids = _loads(value.pop("requirement_ids_json", "[]"), [])
    quotes = _loads(value.pop("quotes_json", "[]"), [])

    def run_number(run_id: Any) -> int | None:
        row = repo.one("SELECT number FROM runs WHERE id=?", (run_id,)) if run_id else None
        return row["number"] if row else None

    return {
        **value,
        "first_run_number": run_number(value.get("first_run_id")),
        "last_seen_run_number": run_number(value.get("last_seen_run_id")),
        "requirement_ids": requirement_ids,
        "quotes": quotes,
        "comments_count": (repo.one("SELECT count(*) AS n FROM comments WHERE defect_key=?", (value["key"],)) or {"n": 0})["n"],
    }


def create_router(service: PlatformService) -> APIRouter:
    router = APIRouter(prefix="/api")
    repo = service.repo

    def project_or_404(key: str) -> dict[str, Any]:
        value = repo.get_project(key)
        if not value:
            raise HTTPException(404, "Проект не найден")
        return value

    @router.get("/projects")
    def projects() -> list[dict[str, Any]]:
        return repo.list_projects()

    @router.post("/projects", status_code=201)
    def create_project(data: dict[str, Any]) -> dict[str, Any]:
        key = str(data.get("key", "")).upper()
        if not re.fullmatch(r"[A-Z][A-Z0-9]{1,9}", key):
            raise HTTPException(400, "Ключ: 2–10 латинских заглавных букв или цифр")
        try:
            return repo.create_project({**data, "key": key})
        except sqlite3.IntegrityError as error:
            raise HTTPException(409, "Проект с таким ключом уже существует") from error

    @router.get("/projects/{key}")
    def get_project(key: str) -> dict[str, Any]:
        return project_or_404(key)

    @router.patch("/projects/{key}")
    def patch_project(key: str, data: dict[str, Any]) -> dict[str, Any]:
        project_or_404(key)
        return repo.update_project(key, data) or {}

    @router.delete("/projects/{key}", status_code=204)
    def delete_project(key: str) -> Response:
        if not repo.delete_project(key):
            raise HTTPException(404, "Проект не найден")
        return Response(status_code=204)

    @router.post("/projects/{key}/star")
    def star_project(key: str) -> dict[str, Any]:
        project = project_or_404(key)
        repo.execute("UPDATE projects SET starred=? WHERE key=?", (int(not project["starred"]), key.upper()))
        return repo.get_project(key) or {}

    @router.get("/projects/{key}/dashboard")
    def dashboard(key: str) -> dict[str, Any]:
        project_or_404(key)
        latest = repo.one("SELECT * FROM runs WHERE project_key=? AND status='done' ORDER BY number DESC LIMIT 1", (key.upper(),)) or {}
        counts = {row["status"]: row["n"] for row in repo.all("SELECT status,count(*) n FROM defects WHERE project_key=? GROUP BY status", (key.upper(),))}
        severity = {row["severity"]: row["n"] for row in repo.all("SELECT severity,count(*) n FROM defects WHERE project_key=? GROUP BY severity", (key.upper(),))}
        criteria = {row["criterion"]: row["n"] for row in repo.all("SELECT criterion,count(*) n FROM defects WHERE project_key=? GROUP BY criterion", (key.upper(),))}
        open_count = sum(counts.get(item, 0) for item in ("open", "in_progress"))
        return {
            "kpis": {"decision": latest.get("decision"), "requirements": latest.get("requirements_count", 0),
                     "open_defects": open_count, "open_critical": (repo.one("SELECT count(*) n FROM defects WHERE project_key=? AND severity='critical' AND status IN ('open','in_progress')", (key.upper(),)) or {"n": 0})["n"],
                     "coverage": latest.get("coverage")},
            "by_severity": severity, "by_status": counts, "by_criterion": criteria,
            "runs_trend": [{"number": row["number"], "date": row["finished_at"], "findings": row["findings_count"]} for row in repo.all("SELECT number,finished_at,findings_count FROM runs WHERE project_key=? AND status='done' ORDER BY number", (key.upper(),))],
        }

    @router.get("/projects/{key}/documents")
    def list_documents(key: str) -> list[dict[str, Any]]:
        project_or_404(key)
        return repo.documents(key)

    @router.post("/projects/{key}/documents", status_code=201)
    async def upload_document(key: str, file: UploadFile = File(...), document_id: str | None = Form(None)) -> dict[str, Any]:
        project_or_404(key)
        filename = Path(file.filename or "").name
        if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, "Допустимы PDF, DOCX, MD и TXT")
        content = await file.read(MAX_UPLOAD + 1)
        await file.close()
        if len(content) > MAX_UPLOAD:
            raise HTTPException(413, "Файл превышает 10 МБ")
        try:
            return repo.add_document_file(key, filename, content, document_id)
        except KeyError as error:
            raise HTTPException(404, "Документ не найден") from error

    @router.get("/documents/{document_id}/versions/{version}/text")
    def document_text(document_id: str, version: int) -> dict[str, Any]:
        item = repo.one("SELECT * FROM document_versions WHERE document_id=? AND version=?", (document_id, version))
        if not item:
            raise HTTPException(404, "Версия не найдена")
        document = load_document(item["path"])
        return {"document_id": document_id, "version": version, "title": document.title, "text": document.text}

    @router.get("/projects/{key}/context")
    def list_context(key: str) -> list[dict[str, Any]]:
        project_or_404(key)
        return repo.context_files(key)

    @router.post("/projects/{key}/context", status_code=201)
    async def upload_context(key: str, file: UploadFile = File(...), type: str = Form("other")) -> dict[str, Any]:
        project_or_404(key)
        if type not in CONTEXT_TYPES:
            raise HTTPException(400, "Неизвестный тип контекста")
        filename = Path(file.filename or "").name
        if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, "Неподдерживаемый формат")
        content = await file.read(MAX_UPLOAD + 1)
        await file.close()
        if len(content) > MAX_UPLOAD:
            raise HTTPException(413, "Файл превышает 10 МБ")
        return repo.add_context_file(key, type, filename, content)

    @router.get("/projects/{key}/context/extracted")
    def extracted_context(key: str) -> dict[str, Any]:
        run = repo.one("SELECT * FROM runs WHERE project_key=? AND status='done' AND options_json LIKE '%\"use_context\": true%' ORDER BY number DESC LIMIT 1", (key.upper(),))
        if not run or not run.get("report_dir"):
            return {}
        payload = json.loads((Path(run["report_dir"]) / "report.json").read_text(encoding="utf-8"))
        return payload.get("context", {}).get("extracted", {})

    @router.get("/projects/{key}/context/{item_id}/preview")
    def context_preview(key: str, item_id: str) -> dict[str, Any]:
        item = repo.one("SELECT * FROM context_files WHERE id=? AND project_key=?", (item_id, key.upper()))
        if not item:
            raise HTTPException(404, "Файл контекста не найден")
        document = load_document(item["path"])
        return {"id": item_id, "filename": item["filename"], "text": document.text}

    @router.delete("/projects/{key}/context/{item_id}", status_code=204)
    def delete_context(key: str, item_id: str) -> Response:
        item = repo.one("SELECT * FROM context_files WHERE id=? AND project_key=?", (item_id, key.upper()))
        if not item:
            raise HTTPException(404, "Файл контекста не найден")
        repo.execute("DELETE FROM context_files WHERE id=?", (item_id,))
        Path(item["path"]).unlink(missing_ok=True)
        return Response(status_code=204)

    @router.get("/projects/{key}/runs")
    def list_runs(key: str) -> list[dict[str, Any]]:
        project_or_404(key)
        return [serialize_run(item) for item in repo.runs(key)]

    @router.post("/projects/{key}/runs", status_code=202)
    def create_run(key: str, data: dict[str, Any]) -> dict[str, Any]:
        project = project_or_404(key)
        version_id = data.get("document_version_id")
        if not repo.one("SELECT id FROM document_versions WHERE id=?", (version_id,)):
            raise HTTPException(400, "Выберите версию документа")
        config = load_config(data.get("provider"), data.get("model"))
        options = {
            "use_context": bool(data.get("use_context", True)), "tests": bool(data.get("tests", False)),
            "domain_check": bool(data.get("domain_check", True)),
            "batch_size": data.get("batch_size", project["settings"].get("batch_size", 12)),
        }
        run = repo.create_run(key, {"document_version_id": version_id, "model": config.model,
                                    "provider": config.provider, "options": options})
        service.submit(run["id"])
        return serialize_run(run)

    @router.get("/runs/compare")
    def compare_runs(a: str, b: str) -> dict[str, Any]:
        first, second = service.run_payload(a), service.run_payload(b)
        first_keys = {item["key"]: item for item in repo.all("SELECT * FROM defects WHERE first_run_id=? OR last_seen_run_id=?", (a, a))}
        second_keys = {item["key"]: item for item in repo.all("SELECT * FROM defects WHERE first_run_id=? OR last_seen_run_id=?", (b, b))}
        return {"a": a, "b": b, "fixed": [first_keys[k] for k in first_keys.keys() - second_keys.keys()],
                "new": [second_keys[k] for k in second_keys.keys() - first_keys.keys()],
                "remaining": [second_keys[k] for k in first_keys.keys() & second_keys.keys()],
                "summaries": [first.get("summary", {}), second.get("summary", {})]}

    @router.get("/projects/{key}/defects")
    def defects(
        key: str, status: str | None = None, severity: str | None = None,
        criterion: str | None = None, type: str | None = None, assignee: str | None = None,
        run: str | None = None, section: str | None = None, q: str | None = None,
        sort: str = "updated_at:desc", page: int = 1, page_size: int = Query(50, le=200),
    ) -> dict[str, Any]:
        project_or_404(key)
        clauses, values = ["project_key=?"], [key.upper()]
        for column, value in (("status", status), ("severity", severity), ("criterion", criterion), ("type", type), ("assignee", assignee)):
            if value:
                clauses.append(f"{column}=?")
                values.append(value)
        if run:
            clauses.append("(first_run_id=? OR last_seen_run_id=?)")
            values.extend([run, run])
        if section:
            clauses.append("location LIKE ?")
            values.append(f"%{section}%")
        if q:
            clauses.append("(key LIKE ? OR title LIKE ? OR explanation LIKE ?)")
            values.extend([f"%{q}%"] * 3)
        allowed_sort = {"updated_at", "created_at", "severity", "status", "number", "key"}
        sort_column, _, direction = sort.partition(":")
        if sort_column not in allowed_sort:
            sort_column = "updated_at"
        direction = "ASC" if direction.lower() == "asc" else "DESC"
        where = " AND ".join(clauses)
        total = (repo.one(f"SELECT count(*) n FROM defects WHERE {where}", tuple(values)) or {"n": 0})["n"]
        rows = repo.all(
            f"SELECT * FROM defects WHERE {where} ORDER BY {sort_column} {direction} LIMIT ? OFFSET ?",
            (*values, page_size, max(0, page - 1) * page_size),
        )
        return {"items": [defect_dict(row, repo) for row in rows], "total": total, "page": page, "page_size": page_size}

    @router.get("/defects/{defect_key}")
    def get_defect(defect_key: str) -> dict[str, Any]:
        value = repo.one("SELECT * FROM defects WHERE key=?", (defect_key,))
        if not value:
            raise HTTPException(404, "Дефект не найден")
        return defect_dict(value, repo)

    def update_defect(defect_key: str, data: dict[str, Any], actor: str = "Пользователь") -> dict[str, Any]:
        current = repo.one("SELECT * FROM defects WHERE key=?", (defect_key,))
        if not current:
            raise HTTPException(404, "Дефект не найден")
        changes = {key: data[key] for key in ("status", "assignee", "reject_reason") if key in data}
        if changes.get("status") not in {None, "open", "in_progress", "fixed", "rejected"}:
            raise HTTPException(400, "Неизвестный статус")
        if changes:
            assignments = ",".join(f"{key}=?" for key in changes)
            repo.execute(f"UPDATE defects SET {assignments},updated_at=? WHERE key=?", (*changes.values(), now_iso(), defect_key))
            repo.add_history(defect_key, actor, "Изменён", _json(changes))
        return get_defect(defect_key)

    @router.patch("/defects/{defect_key}")
    def patch_defect(defect_key: str, data: dict[str, Any]) -> dict[str, Any]:
        return update_defect(defect_key, data)

    @router.post("/defects/bulk")
    def bulk_defects(data: dict[str, Any]) -> dict[str, Any]:
        updated = [update_defect(key, data, "Пользователь · массовое действие") for key in data.get("keys", [])]
        return {"updated": updated}

    @router.get("/defects/{defect_key}/comments")
    def comments(defect_key: str) -> list[dict[str, Any]]:
        get_defect(defect_key)
        return repo.all("SELECT * FROM comments WHERE defect_key=? ORDER BY created_at", (defect_key,))

    @router.post("/defects/{defect_key}/comments", status_code=201)
    def add_comment(defect_key: str, data: dict[str, Any]) -> dict[str, Any]:
        get_defect(defect_key)
        if not str(data.get("text", "")).strip():
            raise HTTPException(400, "Комментарий пуст")
        item = {"id": uuid4().hex, "defect_key": defect_key, "author": data.get("author", "Пользователь"),
                "text": str(data["text"]).strip(), "created_at": now_iso()}
        repo.execute("INSERT INTO comments VALUES(?,?,?,?,?)", tuple(item.values()))
        repo.add_history(defect_key, item["author"], "Добавлен комментарий")
        return item

    @router.get("/defects/{defect_key}/history")
    def defect_history(defect_key: str) -> list[dict[str, Any]]:
        get_defect(defect_key)
        return repo.all("SELECT * FROM history WHERE defect_key=? ORDER BY at DESC", (defect_key,))

    @router.get("/projects/{key}/requirements")
    def requirements(key: str, q: str = "", only_violations: bool = False) -> list[dict[str, Any]]:
        run = repo.one("SELECT id FROM runs WHERE project_key=? AND status='done' ORDER BY number DESC LIMIT 1", (key.upper(),))
        if not run:
            return []
        payload = service.run_payload(run["id"])
        checks = {item["requirement_id"]: item for item in payload.get("requirement_checks", [])}
        result = []
        for requirement in payload.get("requirements", []):
            check = checks.get(requirement["report_id"], {"verdicts": {}, "findings": []})
            item = {**requirement, "verdicts": check["verdicts"], "defect_keys": [f.get("defect_key") for f in check["findings"] if f.get("defect_key")]}
            if q.casefold() not in _json(item).casefold() or (only_violations and not item["defect_keys"]):
                continue
            result.append(item)
        return result

    @router.get("/projects/{key}/traceability")
    def traceability(key: str) -> list[dict[str, Any]]:
        run = repo.one("SELECT id FROM runs WHERE project_key=? AND status='done' ORDER BY number DESC LIMIT 1", (key.upper(),))
        if not run:
            return []
        payload = service.run_payload(run["id"])
        return payload.get("context", {}).get("traceability_matrix") or payload.get("set_check", {}).get("traceability_matrix", [])

    @router.get("/projects/{key}/testcases")
    def testcases(key: str, format: str | None = None) -> Any:
        run = repo.one("SELECT id FROM runs WHERE project_key=? AND status='done' ORDER BY number DESC LIMIT 1", (key.upper(),))
        cases = service.run_payload(run["id"]).get("test_cases", []) if run else []
        if format == "csv":
            stream = io.StringIO()
            writer = csv.writer(stream)
            writer.writerow(["ID", "Требования", "Предусловия", "Шаги", "Ожидаемый результат", "Границы"])
            for item in cases:
                writer.writerow([item.get("id"), ", ".join(item.get("requirement_ids", [])), "; ".join(item.get("preconditions", [])),
                                 "; ".join(item.get("steps", [])), item.get("expected_result"), "; ".join(item.get("boundary_values", []))])
            return PlainTextResponse(stream.getvalue(), media_type="text/csv; charset=utf-8",
                                     headers={"Content-Disposition": "attachment; filename=testcases.csv"})
        return cases

    @router.get("/projects/{key}/filters")
    def filters(key: str) -> list[dict[str, Any]]:
        result = []
        for item in repo.all("SELECT * FROM saved_filters WHERE project_key=?", (key.upper(),)):
            query = _loads(item.pop("query_json"), {})
            result.append({**item, "query": query})
        return result

    @router.post("/projects/{key}/filters", status_code=201)
    def save_filter(key: str, data: dict[str, Any]) -> dict[str, Any]:
        project_or_404(key)
        item = {"id": uuid4().hex, "project_key": key.upper(), "name": data.get("name", "Фильтр"), "query_json": _json(data.get("query", {}))}
        repo.execute("INSERT INTO saved_filters VALUES(?,?,?,?)", tuple(item.values()))
        query = _loads(item.pop("query_json"), {})
        return {**item, "query": query}

    @router.delete("/projects/{key}/filters/{filter_id}", status_code=204)
    def delete_filter(key: str, filter_id: str) -> Response:
        repo.execute("DELETE FROM saved_filters WHERE id=? AND project_key=?", (filter_id, key.upper()))
        return Response(status_code=204)

    @router.get("/projects/{key}/members")
    def members(key: str) -> list[dict[str, Any]]:
        return repo.all("SELECT name,role FROM members WHERE project_key=? ORDER BY name", (key.upper(),))

    @router.put("/projects/{key}/members")
    def put_members(key: str, data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        project_or_404(key)
        with repo.transaction() as connection:
            connection.execute("DELETE FROM members WHERE project_key=?", (key.upper(),))
            connection.executemany("INSERT INTO members VALUES(?,?,?)", [(key.upper(), item["name"], item["role"]) for item in data])
        return members(key)

    @router.get("/search")
    def search(q: str = "") -> dict[str, Any]:
        term = f"%{q}%"
        projects_found = repo.all("SELECT key,name,description FROM projects WHERE key LIKE ? OR name LIKE ? LIMIT 10", (term, term))
        defects_found = repo.all("SELECT key,title,project_key FROM defects WHERE key LIKE ? OR title LIKE ? LIMIT 10", (term, term))
        requirements_found = []
        if q:
            for project in repo.list_projects():
                for item in requirements(project["key"], q):
                    requirements_found.append({"project_key": project["key"], **item})
        return {"projects": projects_found, "defects": defects_found, "requirements": requirements_found[:20]}

    return router
