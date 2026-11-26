from __future__ import annotations

import os
from pathlib import Path

from .db import Repository
from .platform import PlatformService


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    db_path = Path(os.getenv("APP_DB", ROOT / "data" / "app.db"))
    repository = Repository(db_path, ROOT)
    documents = repository.documents("CARD")
    if not documents or not documents[0]["versions"]:
        raise SystemExit("В seed-проекте нет документа")
    version = documents[0]["versions"][0]
    run = repository.create_run("CARD", {
        "document_version_id": version["id"], "provider": "mock", "model": "mock-deterministic",
        "options": {"use_context": True, "tests": True, "domain_check": True, "cache": False},
    })
    PlatformService(repository)._execute(run["id"])
    finished = repository.run(run["id"])
    print(f"Демо-прогон #{finished['number']}: {finished['status']}")
    return 0 if finished["status"] == "done" else 1


if __name__ == "__main__":
    raise SystemExit(main())
