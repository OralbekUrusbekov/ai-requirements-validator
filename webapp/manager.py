from __future__ import annotations

from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime
import json
from pathlib import Path
import re
import shutil
import threading
from typing import Any
from uuid import uuid4

from validator.config import load_config
from validator.llm import mask_secrets
from validator.pipeline import run_pipeline


RUN_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def safe_error(error: Exception, secrets: tuple[str, ...] = ()) -> str:
    message = mask_secrets(" ".join(str(error).split()), secrets)
    if not message:
        message = type(error).__name__
    return f"Не удалось выполнить проверку: {message[:500]}"


class RunManager:
    def __init__(self, runs_dir: Path, project_root: Path):
        self.runs_dir = runs_dir
        self.project_root = project_root
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="requirements-validator")
        self._futures: dict[str, Future[None]] = {}
        self._recover_interrupted()

    def _run_dir(self, run_id: str) -> Path:
        if not RUN_ID_PATTERN.fullmatch(run_id):
            raise KeyError(run_id)
        path = self.runs_dir / run_id
        if not path.is_dir():
            raise KeyError(run_id)
        return path

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any]:
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _write_json(path: Path, value: dict[str, Any]) -> None:
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    def _recover_interrupted(self) -> None:
        for meta_path in self.runs_dir.glob("*/meta.json"):
            try:
                meta = self._read_json(meta_path)
                if meta.get("status") in {"queued", "running"}:
                    meta.update(
                        status="error",
                        current_label="Запуск прерван перезапуском сервера",
                        error="Запуск был прерван перезапуском сервера. Запустите проверку повторно.",
                        finished_at=now_iso(),
                    )
                    self._write_json(meta_path, meta)
            except (OSError, ValueError):
                continue

    def create(
        self, original_name: str, extension: str, provider: str | None, model: str | None,
        *, generate_tests: bool = False, domain_check: bool = True,
        report_format: str = "md", context_used: bool = False,
    ) -> tuple[str, Path]:
        settings = load_config(provider, model)
        run_id = uuid4().hex
        directory = self.runs_dir / run_id
        directory.mkdir(parents=True)
        input_path = directory / f"input{extension}"
        meta = {
            "run_id": run_id,
            "title": original_name,
            "original_name": original_name,
            "input_file": input_path.name,
            "status": "queued",
            "current_step": 1,
            "current_label": "В очереди",
            "progress": 0,
            "created_at": now_iso(),
            "started_at": None,
            "finished_at": None,
            "provider": settings.provider,
            "model": settings.model,
            "batch_size": settings.check_batch_size,
            "requirement_count": 0,
            "finding_count": 0,
            "decision": None,
            "error": None,
            "generate_tests": generate_tests,
            "domain_check": domain_check,
            "report_format": report_format,
            "context_used": context_used,
        }
        self._write_json(directory / "meta.json", meta)
        return run_id, input_path

    def submit(self, run_id: str) -> None:
        with self._lock:
            self._futures[run_id] = self._executor.submit(self._execute, run_id)

    def _update(self, run_id: str, **changes: Any) -> dict[str, Any]:
        with self._lock:
            path = self._run_dir(run_id) / "meta.json"
            meta = self._read_json(path)
            meta.update(changes)
            self._write_json(path, meta)
            return meta

    def _execute(self, run_id: str) -> None:
        try:
            meta = self._update(
                run_id, status="running", current_step=1, current_label="Загрузка", progress=1,
                started_at=now_iso(), error=None,
            )
            directory = self._run_dir(run_id)
            source = directory / meta["input_file"]

            def progress(event: dict[str, Any]) -> None:
                self._update(
                    run_id,
                    current_step=event["step"],
                    current_label=event["label"],
                    progress=event["progress"],
                    batch=event.get("batch"),
                    batches=event.get("batches"),
                )

            settings = load_config(meta["provider"], meta["model"], meta.get("batch_size"))
            context_dir = directory / "context"
            context_paths = [str(path) for path in sorted(context_dir.glob("*"))] if context_dir.is_dir() else None
            report_format = meta.get("report_format", "md")
            result = run_pipeline(
                str(source), str(directory / f"report.{report_format}"), settings,
                progress_callback=progress, context_paths=context_paths,
                domain_check=meta.get("domain_check", True),
                generate_tests=meta.get("generate_tests", False),
            )
            summary = result.payload["summary"]
            result.payload["metadata"].update(
                run_id=run_id, original_name=meta["original_name"]
            )
            self._write_json(directory / "report.json", result.payload)
            self._update(
                run_id,
                status="done",
                current_step=5,
                current_label="Отчёт готов",
                progress=100,
                finished_at=now_iso(),
                title=result.payload["metadata"].get("title") or meta["title"],
                requirement_count=summary["requirement_count"],
                finding_count=summary["finding_count"],
                decision=summary["decision"],
                context_used=bool(context_paths),
            )
        except Exception as error:
            try:
                secrets: tuple[str, ...] = ()
                try:
                    configured = load_config()
                    secrets = tuple(filter(None, (configured.gemini_api_key, configured.openai_api_key)))
                except ValueError:
                    pass
                self._update(
                    run_id, status="error", current_label="Ошибка", finished_at=now_iso(),
                    error=safe_error(error, secrets),
                )
            except (KeyError, OSError, ValueError):
                pass

    def get(self, run_id: str) -> dict[str, Any]:
        with self._lock:
            directory = self._run_dir(run_id)
            return self._read_json(directory / "meta.json")

    def list(self) -> list[dict[str, Any]]:
        result = []
        for path in self.runs_dir.glob("*/meta.json"):
            try:
                result.append(self._read_json(path))
            except (OSError, ValueError):
                continue
        return sorted(result, key=lambda item: item.get("created_at", ""), reverse=True)

    def report(self, run_id: str) -> dict[str, Any]:
        directory = self._run_dir(run_id)
        path = directory / "report.json"
        if not path.is_file():
            raise FileNotFoundError(path)
        return self._read_json(path)

    def file(self, run_id: str, name: str) -> Path:
        if name not in {"report.md", "report.json", "report.html", "report.docx", "report.pdf"}:
            raise KeyError(name)
        path = self._run_dir(run_id) / name
        if not path.is_file():
            raise FileNotFoundError(path)
        return path

    def delete(self, run_id: str) -> None:
        with self._lock:
            meta = self.get(run_id)
            future = self._futures.get(run_id)
            if meta["status"] == "running":
                raise RuntimeError("Нельзя удалить выполняющийся запуск")
            if meta["status"] == "queued" and future and not future.cancel():
                raise RuntimeError("Запуск уже начал выполняться")
            directory = self._run_dir(run_id)
            shutil.rmtree(directory)
            self._futures.pop(run_id, None)
