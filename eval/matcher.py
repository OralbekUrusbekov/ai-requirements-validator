from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from validator.verifier import quote_exists


def load_cases(path: str | Path) -> list[dict[str, Any]]:
    text = Path(path).read_text(encoding="utf-8")
    try:
        import yaml
        value = yaml.safe_load(text)
    except ImportError:
        value = json.loads(text)
    return value.get("cases", value) if isinstance(value, dict) else value


def report_findings(report: dict[str, Any]) -> list[dict[str, Any]]:
    findings = [
        item for check in report.get("requirement_checks", [])
        for item in check.get("findings", []) if isinstance(item, dict)
    ]
    findings.extend(
        item for item in report.get("set_check", {}).get("findings", []) if isinstance(item, dict)
    )
    for item in report.get("context", {}).get("findings", []):
        if isinstance(item, dict):
            findings.append({
                **item, "criterion": item.get("type", "context"),
                "quote": item.get("requirement_quote", ""),
                "related_quotes": [item.get("context_quote", "")],
                "quote_verified": bool(item.get("requirement_quote_verified") and item.get("context_quote_verified")),
            })
    return findings


def evaluate(report: dict[str, Any], cases: list[dict[str, Any]]) -> dict[str, Any]:
    findings = report_findings(report)
    rows = []
    for case in cases:
        anchors = case.get("anchor_quotes", [])
        categories = case.get("categories") or [
            case.get("category") or case.get("criterion") or case.get("criterion_category", "")
        ]
        matched = None
        for finding in findings:
            if categories and finding.get("criterion") not in categories:
                continue
            quotes = [finding.get("quote", ""), *finding.get("related_quotes", [])]
            if all(any(quote_exists(anchor, quote, threshold=0.78) or quote_exists(quote, anchor, threshold=0.78)
                       for quote in quotes if quote) for anchor in anchors):
                matched = finding
                break
        rows.append({"id": case.get("id"), "description": case.get("description"), "hit": matched is not None})
    hits = sum(row["hit"] for row in rows)
    verified = sum(bool(item.get("quote_verified")) for item in findings)
    return {
        "recall": hits / len(rows) if rows else 1.0,
        "precision_proxy": verified / len(findings) if findings else 1.0,
        "hits": hits, "total": len(rows), "rows": rows,
    }


def render_results(result: dict[str, Any]) -> str:
    lines = ["# Результаты eval", "", f"- Recall: {result['recall']:.1%}",
             f"- Precision proxy: {result['precision_proxy']:.1%}", "",
             "| ID | Ожидаемый дефект | Результат |", "|---|---|---|"]
    lines.extend(
        f"| {row['id']} | {str(row['description']).replace('|', '/')} | {'HIT' if row['hit'] else 'MISS'} |"
        for row in result["rows"]
    )
    return "\n".join(lines) + "\n"
