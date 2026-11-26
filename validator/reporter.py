from __future__ import annotations

from collections import Counter
from dataclasses import asdict
from datetime import datetime
import json
from pathlib import Path
import subprocess

from . import __version__
from .loader import Document
from .models import Finding, Requirement, RequirementCheck, SetCheck


CRITERION_RU = {
    "necessary": "Необходимость", "appropriate": "Уместность", "unambiguous": "Однозначность",
    "complete": "Полнота", "singular": "Единичность", "feasible": "Реализуемость",
    "verifiable": "Проверяемость", "correct": "Корректность", "conforming": "Соответствие форме",
    "consistent": "Согласованность", "comprehensible": "Понятность",
    "able_to_be_validated": "Валидируемость", "ranked_importance_stability": "Приоритет и стабильность",
    "modifiable": "Модифицируемость", "traceable": "Трассируемость",
}
VERDICT_RU = {"ok": "OK", "violation": "Нарушение", "n.a.": "Н/П"}
SEVERITY_RU = {"critical": "критический", "major": "существенный", "minor": "незначительный"}


def agent_version(root: Path | None = None) -> str:
    try:
        cwd = root or Path.cwd()
        commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()
        dirty = bool(subprocess.run(["git", "status", "--porcelain"], cwd=cwd, capture_output=True, text=True, check=True).stdout.strip())
        return f"{__version__}+{commit}{'-dirty' if dirty else ''}"
    except (OSError, subprocess.SubprocessError):
        return f"{__version__}+unknown"


def _escape(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def _finding_block(finding: Finding) -> list[str]:
    ids = f" ({', '.join(finding.requirement_ids)})" if finding.requirement_ids else ""
    lines = [f"- **{SEVERITY_RU.get(finding.severity, finding.severity).capitalize()} — {CRITERION_RU.get(finding.criterion, finding.criterion)}{ids}.** {finding.explanation}",
             f"  - Цитата: «{finding.quote}»", f"  - Место: {finding.location}"]
    if finding.related_quotes:
        lines.append("  - Связанные цитаты: " + "; ".join(f"«{q}»" for q in finding.related_quotes))
    lines.append(f"  - Исправление: {finding.fix}")
    lines.append(f"  - Проверка цитаты: {'подтверждена' if finding.quote_verified else 'цитата не подтверждена'}")
    return lines


def render_report(document: Document, requirements: list[Requirement], checks: list[RequirementCheck], set_check: SetCheck,
                  provider: str, model: str, source_path: str, run_at: datetime | None = None,
                  coverage: dict | None = None) -> str:
    timestamp = run_at or datetime.now().astimezone()
    all_findings = [finding for check in checks for finding in check.findings] + set_check.findings
    severity = Counter(item.severity for item in all_findings)
    criteria = Counter(item.criterion for item in all_findings)
    critical = [item for item in all_findings if item.severity == "critical" or item.criterion in {"verifiable", "consistent", "complete"}]
    coverage_text = f"{coverage['percent']}%" if coverage and "percent" in coverage else "не рассчитано"
    lines = [f"# Отчёт о проверке требований: {document.title}", "", "## 1. Паспорт прогона", "",
             f"- Название документа: {document.title}", f"- Путь: `{source_path}`",
             f"- Дата и время: {timestamp.isoformat(timespec='seconds')}", f"- Провайдер и модель: {provider} / {model}",
             f"- Версия агента: {agent_version()}",
             f"- Покрытие исходных фрагментов: {coverage_text}",
             "", "## 2. Как агент нарезал требования", "",
             "| ID в отчёте | ID в документе | Раздел | Краткая формулировка | Цитата |",
             "|---|---|---|---|---|"]
    for req in requirements:
        quote = req.quote + (" [цитата сегмента не подтверждена]" if not req.quote_verified else "")
        lines.append(f"| {req.report_id} | {_escape(req.source_id)} | {_escape(req.section)} | {_escape(req.short_text)} | «{_escape(quote)}» |")
    lines.extend(["", "## 3. Проверка каждого требования", ""])
    by_id = {item.report_id: item for item in requirements}
    for check in checks:
        req = by_id[check.requirement_id]
        lines.extend([f"### {check.requirement_id} — {req.short_text}", "", "| Критерий | Вердикт |", "|---|---|"])
        lines.extend(f"| {CRITERION_RU.get(key, key)} | {VERDICT_RU.get(value, value)} |" for key, value in check.verdicts.items())
        lines.extend(["", "**Нарушения**", ""])
        if check.findings:
            for finding in check.findings:
                lines.extend(_finding_block(finding))
        else:
            lines.append("Нарушений не обнаружено.")
        lines.append("")
    lines.extend(["## 4. Проверка всего набора требований", "", "| Критерий | Вердикт |", "|---|---|"])
    lines.extend(f"| {CRITERION_RU.get(key, key)} | {VERDICT_RU.get(value, value)} |" for key, value in set_check.verdicts.items())
    lines.extend(["", f"Трассируемость: {set_check.traceability or 'Оценка не предоставлена.'}", ""])
    if set_check.missing_sections:
        lines.append("Отмеченные отсутствующие разделы: " + ", ".join(set_check.missing_sections) + ".")
        lines.append("")
    if set_check.findings:
        for finding in set_check.findings:
            lines.extend(_finding_block(finding))
    else:
        lines.append("Нарушений на уровне набора не обнаружено.")
    lines.extend(["", "## 5. Сводка", "", f"- Требований выделено: {len(requirements)}.", f"- Нарушений: {len(all_findings)}.",
                  f"- По серьёзности: critical — {severity['critical']}, major — {severity['major']}, minor — {severity['minor']}.",
                  "- По критериям: " + (", ".join(f"{CRITERION_RU.get(k, k)} — {v}" for k, v in sorted(criteria.items())) or "нет") + ".",
                  "", "### Критические дефекты (непроверяемые, противоречивые, неполные)", ""])
    if critical:
        for finding in critical:
            lines.append(f"- {', '.join(finding.requirement_ids) or 'набор'}: {finding.explanation}")
    else:
        lines.append("Не выявлены.")
    critical_count = severity["critical"]
    major_count = severity["major"]
    decision = "Нет" if critical_count else ("С оговорками" if major_count else "Да")
    justification = "есть критические дефекты" if critical_count else ("существенные дефекты требуют исправления" if major_count else "выявленных блокирующих дефектов нет")
    prioritized = sorted(all_findings, key=lambda item: {"critical": 0, "major": 1, "minor": 2}.get(item.severity, 3))
    lines.extend(["", "## 6. Итог", "", f"**Можно ли начинать разработку и тестирование: {decision}.** Причина: {justification}.", "", "Приоритетный список исправлений:", ""])
    if prioritized:
        lines.extend(f"{index}. {item.fix}" for index, item in enumerate(prioritized, 1))
    else:
        lines.append("1. Дополнительные исправления по результатам этого прогона не требуются.")
    return "\n".join(lines) + "\n"


def report_summary(
    requirements: list[Requirement], checks: list[RequirementCheck], set_check: SetCheck
) -> dict:
    findings = [finding for check in checks for finding in check.findings] + set_check.findings
    severity = Counter(item.severity for item in findings)
    criteria = Counter(item.criterion for item in findings)
    critical = [
        item for item in findings
        if item.severity == "critical" or item.criterion in {"verifiable", "consistent", "complete"}
    ]
    decision = "Нет" if severity["critical"] else ("С оговорками" if severity["major"] else "Да")
    justification = (
        "есть критические дефекты" if severity["critical"]
        else "существенные дефекты требуют исправления" if severity["major"]
        else "выявленных блокирующих дефектов нет"
    )
    prioritized = sorted(
        findings, key=lambda item: {"critical": 0, "major": 1, "minor": 2}.get(item.severity, 3)
    )
    return {
        "requirement_count": len(requirements),
        "finding_count": len(findings),
        "by_severity": {key: severity[key] for key in ("critical", "major", "minor")},
        "by_criterion": dict(sorted(criteria.items())),
        "critical_defects": [asdict(item) for item in critical],
        "decision": decision,
        "justification": justification,
        "prioritized_fixes": [item.fix for item in prioritized],
    }


def build_payload(
    metadata: dict,
    requirements: list[Requirement],
    checks: list[RequirementCheck],
    set_check: SetCheck,
) -> dict:
    full_metadata = {**metadata, "agent_version": metadata.get("agent_version") or agent_version()}
    return {
        "metadata": full_metadata,
        "requirements": [asdict(item) for item in requirements],
        "requirement_checks": [asdict(item) for item in checks],
        "set_check": asdict(set_check),
        "summary": report_summary(requirements, checks, set_check),
    }


def write_outputs(report_path: str | Path, report: str, metadata: dict, requirements: list[Requirement],
                  checks: list[RequirementCheck], set_check: SetCheck,
                  payload: dict | None = None) -> tuple[Path, Path]:
    path = Path(report_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(report, encoding="utf-8")
    json_path = path.with_suffix(".json")
    payload = payload or build_payload(metadata, requirements, checks, set_check)
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path, json_path
