from __future__ import annotations

from difflib import SequenceMatcher
import re

from .loader import Document
from .models import Finding


def normalize(value: str) -> str:
    value = value.replace("ё", "е").casefold()
    return re.sub(r"[^\w]+", " ", value, flags=re.UNICODE).strip()


def quote_exists(quote: str, source: str, threshold: float = 0.88) -> bool:
    needle, haystack = normalize(quote), normalize(source)
    if not needle:
        return False
    if needle in haystack:
        return True
    words = needle.split()
    source_words = haystack.split()
    if len(words) < 3 or len(source_words) < len(words):
        return False
    window_sizes = {max(1, len(words) - 2), len(words), len(words) + 2}
    for size in window_sizes:
        for start in range(0, max(0, len(source_words) - size + 1)):
            candidate = " ".join(source_words[start : start + size])
            if SequenceMatcher(None, needle, candidate).ratio() >= threshold:
                return True
    return False


def verify_findings(document: Document, findings: list[Finding]) -> list[Finding]:
    unique: list[Finding] = []
    seen: set[tuple[str, str, str, tuple[str, ...]]] = set()
    for finding in findings:
        all_quotes = [finding.quote, *finding.related_quotes]
        finding.quote_verified = bool(all_quotes) and all(quote_exists(item, document.text) for item in all_quotes)
        if not finding.quote_verified and "цитата не подтверждена" not in finding.explanation:
            finding.explanation += " [цитата не подтверждена]"
        if finding.location == "Раздел не определён" and finding.quote:
            finding.location = document.location_for(finding.quote)
        key = (finding.criterion, normalize(finding.quote), normalize(finding.explanation), tuple(sorted(finding.requirement_ids)))
        if key not in seen:
            seen.add(key)
            unique.append(finding)
    return unique
