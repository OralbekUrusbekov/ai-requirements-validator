from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re


@dataclass(frozen=True)
class SourceLine:
    number: int
    section: str
    text: str


@dataclass(frozen=True)
class Document:
    path: Path
    title: str
    text: str
    lines: tuple[SourceLine, ...]

    def location_for(self, quote: str) -> str:
        needle = _normalize(quote)
        for line in self.lines:
            candidate = _normalize(line.text)
            if needle and candidate and (needle in candidate or candidate in needle):
                return f"{line.section}, строка {line.number}"
        return "Раздел не определён"


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def _from_text(path: Path, text: str, markdown: bool) -> Document:
    heading = "Начало документа"
    title = path.stem
    result: list[SourceLine] = []
    for number, raw in enumerate(text.splitlines(), 1):
        stripped = raw.strip()
        if markdown and re.match(r"^#{1,6}\s+", stripped):
            heading = re.sub(r"^#{1,6}\s+", "", stripped).strip()
            if stripped.startswith("# ") and title == path.stem:
                title = heading
        result.append(SourceLine(number, heading, raw))
    return Document(path, title, text, tuple(result))


def _load_pdf(path: Path) -> Document:
    import fitz

    pages: list[str] = []
    lines: list[SourceLine] = []
    number = 0
    with fitz.open(path) as pdf:
        for page_index, page in enumerate(pdf, 1):
            page_text = page.get_text("text")
            pages.append(page_text)
            for raw in page_text.splitlines():
                number += 1
                lines.append(SourceLine(number, f"Страница {page_index}", raw))
    text = "\n".join(pages)
    title = next(
        (
            line.text.strip() for line in lines
            if line.text.strip() and len(re.findall(r"[\w]", line.text, flags=re.UNICODE)) >= 3
        ),
        path.stem,
    )
    return Document(path, title, text, tuple(lines))


def _load_docx(path: Path) -> Document:
    from docx import Document as WordDocument

    word = WordDocument(path)
    collected: list[tuple[str, str]] = []
    heading = "Начало документа"
    title = path.stem
    for paragraph in word.paragraphs:
        value = paragraph.text.strip()
        if paragraph.style and paragraph.style.name.startswith("Heading") and value:
            heading = value
            if title == path.stem:
                title = value
        if value:
            collected.append((heading, value))
    for table_index, table in enumerate(word.tables, 1):
        table_section = f"{heading} — таблица {table_index}"
        for row in table.rows:
            values = [cell.text.strip() for cell in row.cells]
            collected.append((table_section, " | ".join(values)))
    lines = tuple(SourceLine(i, section, value) for i, (section, value) in enumerate(collected, 1))
    return Document(path, title, "\n".join(item.text for item in lines), lines)


def load_document(filename: str | Path) -> Document:
    path = Path(filename)
    if not path.is_file():
        raise FileNotFoundError(f"Документ не найден: {path}")
    suffix = path.suffix.lower()
    if suffix in {".md", ".txt"}:
        return _from_text(path, path.read_text(encoding="utf-8"), suffix == ".md")
    if suffix == ".pdf":
        return _load_pdf(path)
    if suffix == ".docx":
        return _load_docx(path)
    raise ValueError(f"Неподдерживаемый формат: {suffix}. Допустимы .md, .txt, .pdf, .docx")
