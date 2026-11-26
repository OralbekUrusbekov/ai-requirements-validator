from __future__ import annotations

import argparse
import sys
import traceback

from validator.config import load_config
from validator.pipeline import run_pipeline


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Статическая ИИ-проверка документа требований")
    parser.add_argument("source", help="Путь к .md, .txt, .pdf или .docx")
    parser.add_argument("report", help="Путь для Markdown-отчёта")
    parser.add_argument("--model", help="Переопределить модель")
    parser.add_argument("--provider", choices=("gemini", "openai", "mock"), help="LLM-провайдер")
    parser.add_argument("--batch-size", type=int, help="Число требований в одном запросе проверки")
    parser.add_argument("--verbose", action="store_true", help="Подробный прогресс")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        settings = load_config(args.provider, args.model, args.batch_size)
        result = run_pipeline(args.source, args.report, settings, args.verbose)
        print(f"Отчёт: {result.report_path}")
        print(f"JSON: {result.json_path}")
        print(f"Требований: {result.requirements_count}; нарушений: {result.findings_count}")
        return 0
    except Exception as error:
        if args.verbose:
            traceback.print_exc()
        else:
            message = " ".join(str(error).split()) or type(error).__name__
            if len(message) > 400:
                message = message[:397] + "..."
            print(f"Ошибка: {message}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
