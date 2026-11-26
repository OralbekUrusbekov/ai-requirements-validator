from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from collections.abc import Callable
import sys
from typing import Any

from .checker import check_requirements
from .config import Settings
from .llm import create_provider
from .loader import load_document
from .reporter import build_payload, render_report, write_outputs
from .segmenter import segment
from .set_checker import check_set
from .verifier import verify_findings


@dataclass(frozen=True)
class PipelineResult:
    report_path: Path
    json_path: Path
    requirements_count: int
    findings_count: int
    warnings: tuple[str, ...]
    payload: dict[str, Any]


ProgressCallback = Callable[[dict[str, Any]], None]


def _progress(message: str) -> None:
    print(f"[validator] {message}", file=sys.stderr, flush=True)


def _notify(callback: ProgressCallback | None, step: int, label: str, percent: int, **detail: Any) -> None:
    if callback:
        callback({"step": step, "label": label, "progress": percent, **detail})


def run_pipeline(
    source: str,
    destination: str,
    settings: Settings,
    verbose: bool = False,
    progress_callback: ProgressCallback | None = None,
) -> PipelineResult:
    _progress("1/5 Загрузка документа")
    _notify(progress_callback, 1, "Загрузка", 5)
    document = load_document(source)
    provider = create_provider(settings, verbose=verbose)
    _progress(f"2/5 Сегментация требований ({provider.name}/{provider.model})")
    _notify(progress_callback, 2, "Сегментация", 15)
    requirements, warnings, coverage = segment(document, provider, include_coverage=True)
    if verbose:
        _progress(f"Выделено требований: {len(requirements)}")
        for warning in warnings:
            _progress(f"Предупреждение: {warning}")
    batch_size = settings.check_batch_size
    batches = max(1, (len(requirements) + batch_size - 1) // batch_size)
    _progress(f"3/5 Проверка отдельных требований пакетами по {batch_size}")
    _notify(progress_callback, 3, "Проверка требований", 35, batch=0, batches=batches)

    def batch_progress(batch: int, batches: int) -> None:
        percent = 35 + round(35 * batch / batches)
        _notify(progress_callback, 3, f"Проверка требований (пакет {batch}/{batches})", percent,
                batch=batch, batches=batches)

    checks = check_requirements(
        document, requirements, provider, batch_size=batch_size, progress_callback=batch_progress
    )
    _progress("4/5 Проверка набора и верификация цитат")
    _notify(progress_callback, 4, "Проверка набора и цитат", 75)
    set_check = check_set(document, requirements, provider)
    for check in checks:
        check.findings = verify_findings(document, check.findings)
    set_check.findings = verify_findings(document, set_check.findings)
    findings_count = sum(len(item.findings) for item in checks) + len(set_check.findings)
    _progress("5/5 Запись Markdown и JSON")
    _notify(progress_callback, 5, "Отчёт", 92)
    run_at = datetime.now().astimezone()
    report = render_report(
        document, requirements, checks, set_check, provider.name, provider.model, source, run_at,
        coverage=coverage,
    )
    metadata = {
        "title": document.title, "source_path": source, "run_at": run_at.isoformat(),
        "provider": provider.name, "model": provider.model, "segmentation_warnings": warnings,
        "coverage_percent": coverage["percent"],
        "coverage_units": {"covered": coverage["covered_units"], "total": coverage["total_units"]},
        "coverage_skipped_units": coverage["skipped_units"],
    }
    payload = build_payload(metadata, requirements, checks, set_check)
    report_path, json_path = write_outputs(
        destination, report, metadata, requirements, checks, set_check, payload=payload,
    )
    _notify(progress_callback, 5, "Отчёт готов", 100)
    _progress(f"Готово: {report_path} и {json_path}")
    return PipelineResult(
        report_path, json_path, len(requirements), findings_count, tuple(warnings), payload
    )
