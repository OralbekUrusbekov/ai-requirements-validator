from __future__ import annotations

from pathlib import Path
import shutil

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from validator.config import load_config
from .manager import RunManager


MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".md", ".txt"}
PROJECT_ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = Path(__file__).resolve().parent / "static"


def create_app(runs_dir: Path | None = None) -> FastAPI:
    application = FastAPI(title="Агент проверки требований", version="0.1.0")
    manager = RunManager(runs_dir or PROJECT_ROOT / "runs", PROJECT_ROOT)
    application.state.run_manager = manager
    application.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    def not_found() -> HTTPException:
        return HTTPException(status_code=404, detail="Запуск не найден")

    @application.get("/api/config")
    def config() -> dict:
        settings = load_config()
        configured = (
            bool(settings.gemini_api_key) if settings.provider == "gemini"
            else bool(settings.openai_api_key or settings.openai_base_url) if settings.provider == "openai"
            else True
        )
        return {
            "provider": settings.provider, "model": settings.model,
            "batch_size": settings.check_batch_size, "api_key_configured": configured,
        }

    @application.post("/api/runs", status_code=202)
    async def create_run(
        file: UploadFile = File(...),
        context: list[UploadFile] = File(default=[]),
        provider: str | None = Form(None),
        model: str | None = Form(None),
        generate_tests: bool = Form(False),
        domain_check: bool = Form(True),
        report_format: str = Form("md"),
    ) -> dict:
        filename = Path(file.filename or "").name
        extension = Path(filename).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Допустимы только PDF, DOCX, MD и TXT")
        if provider and provider not in {"gemini", "openai", "mock"}:
            raise HTTPException(status_code=400, detail="Неизвестный LLM-провайдер")
        if report_format not in {"md", "html", "docx", "json"}:
            raise HTTPException(status_code=400, detail="Неизвестный формат отчёта")
        try:
            run_id, destination = manager.create(
                filename, extension, provider, model, generate_tests=generate_tests,
                domain_check=domain_check, report_format=report_format, context_used=bool(context),
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        size = 0
        try:
            with destination.open("wb") as output:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_UPLOAD_BYTES:
                        raise HTTPException(status_code=413, detail="Файл превышает лимит 10 МБ")
                    output.write(chunk)
        except Exception:
            shutil.rmtree(destination.parent, ignore_errors=True)
            raise
        finally:
            await file.close()
        if context:
            context_dir = destination.parent / "context"
            context_dir.mkdir()
            for index, upload in enumerate(context):
                context_name = Path(upload.filename or "").name
                context_ext = Path(context_name).suffix.lower()
                if context_ext not in ALLOWED_EXTENSIONS:
                    shutil.rmtree(destination.parent, ignore_errors=True)
                    raise HTTPException(status_code=400, detail="Контекст: неподдерживаемый формат")
                data = await upload.read(MAX_UPLOAD_BYTES + 1)
                await upload.close()
                if len(data) > MAX_UPLOAD_BYTES:
                    shutil.rmtree(destination.parent, ignore_errors=True)
                    raise HTTPException(status_code=413, detail="Файл контекста превышает 10 МБ")
                (context_dir / f"{index:02d}_{context_name}").write_bytes(data)
        manager.submit(run_id)
        return {"run_id": run_id}

    @application.post("/api/demo", status_code=202)
    def demo(
        provider: str | None = None, model: str | None = None, with_context: bool = False,
        generate_tests: bool = False, domain_check: bool = True,
    ) -> dict:
        if provider and provider not in {"gemini", "openai", "mock"}:
            raise HTTPException(status_code=400, detail="Неизвестный LLM-провайдер")
        source = PROJECT_ROOT / "docs" / "requirements.md"
        try:
            run_id, destination = manager.create(
                source.name, source.suffix, provider, model, generate_tests=generate_tests,
                domain_check=domain_check, context_used=with_context,
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        shutil.copyfile(source, destination)
        if with_context:
            shutil.copytree(PROJECT_ROOT / "examples" / "context", destination.parent / "context")
        manager.submit(run_id)
        return {"run_id": run_id}

    @application.get("/api/runs")
    def history() -> list[dict]:
        return manager.list()

    @application.get("/api/runs/{run_id}")
    def run_status(run_id: str) -> dict:
        try:
            return manager.get(run_id)
        except KeyError:
            raise not_found()

    @application.get("/api/runs/{run_id}/report")
    def structured_report(run_id: str) -> dict:
        try:
            return manager.report(run_id)
        except KeyError:
            raise not_found()
        except FileNotFoundError:
            raise HTTPException(status_code=409, detail="Отчёт ещё не готов")

    @application.get("/api/runs/{run_id}/report.md")
    def markdown_report(run_id: str) -> FileResponse:
        try:
            path = manager.file(run_id, "report.md")
        except KeyError:
            raise not_found()
        except FileNotFoundError:
            raise HTTPException(status_code=409, detail="Отчёт ещё не готов")
        return FileResponse(path, media_type="text/markdown; charset=utf-8", filename=f"report-{run_id}.md")

    @application.get("/api/runs/{run_id}/report.json")
    def json_report(run_id: str) -> FileResponse:
        try:
            path = manager.file(run_id, "report.json")
        except KeyError:
            raise not_found()
        except FileNotFoundError:
            raise HTTPException(status_code=409, detail="Отчёт ещё не готов")
        return FileResponse(path, media_type="application/json", filename=f"report-{run_id}.json")

    @application.get("/api/runs/{run_id}/files/{name}")
    def report_file(run_id: str, name: str) -> FileResponse:
        try:
            path = manager.file(run_id, name)
        except KeyError:
            raise not_found()
        except FileNotFoundError:
            raise HTTPException(status_code=409, detail="Файл ещё не готов")
        return FileResponse(path, filename=f"{run_id}-{name}")

    @application.delete("/api/runs/{run_id}", status_code=204, response_class=Response)
    def delete_run(run_id: str) -> Response:
        try:
            manager.delete(run_id)
        except KeyError:
            raise not_found()
        except RuntimeError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
        return Response(status_code=204)

    def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    application.add_api_route("/", index, methods=["GET"], include_in_schema=False)
    application.add_api_route("/history", index, methods=["GET"], include_in_schema=False)
    application.add_api_route("/runs/{run_id}", index, methods=["GET"], include_in_schema=False)
    return application


app = create_app()
