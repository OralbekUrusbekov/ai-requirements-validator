from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
import json
from pathlib import Path
import shutil
import sqlite3
import threading
from typing import Any, Iterator
from uuid import uuid4


SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS projects(
 key TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', owner TEXT NOT NULL,
 starred INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, settings_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS members(project_key TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL,
 PRIMARY KEY(project_key,name), FOREIGN KEY(project_key) REFERENCES projects(key) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, project_key TEXT NOT NULL, name TEXT NOT NULL,
 created_at TEXT NOT NULL, FOREIGN KEY(project_key) REFERENCES projects(key) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS document_versions(id TEXT PRIMARY KEY, document_id TEXT NOT NULL, version INTEGER NOT NULL,
 filename TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL, uploaded_at TEXT NOT NULL,
 UNIQUE(document_id,version), FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS context_files(id TEXT PRIMARY KEY, project_key TEXT NOT NULL, type TEXT NOT NULL,
 filename TEXT NOT NULL, path TEXT NOT NULL, version INTEGER NOT NULL, uploaded_at TEXT NOT NULL,
 FOREIGN KEY(project_key) REFERENCES projects(key) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, project_key TEXT NOT NULL, number INTEGER NOT NULL,
 document_version_id TEXT NOT NULL, model TEXT NOT NULL, provider TEXT NOT NULL, options_json TEXT NOT NULL,
 status TEXT NOT NULL, step TEXT NOT NULL, progress INTEGER NOT NULL, started_at TEXT, finished_at TEXT,
 error TEXT, agent_version TEXT, requirements_count INTEGER NOT NULL DEFAULT 0,
 findings_count INTEGER NOT NULL DEFAULT 0, coverage REAL, decision TEXT, report_dir TEXT,
 UNIQUE(project_key,number), FOREIGN KEY(project_key) REFERENCES projects(key) ON DELETE CASCADE,
 FOREIGN KEY(document_version_id) REFERENCES document_versions(id));
CREATE TABLE IF NOT EXISTS defects(key TEXT PRIMARY KEY, project_key TEXT NOT NULL, number INTEGER NOT NULL,
 fingerprint TEXT NOT NULL, title TEXT NOT NULL, severity TEXT NOT NULL, criterion TEXT NOT NULL,
 type TEXT NOT NULL, status TEXT NOT NULL, assignee TEXT, requirement_ids_json TEXT NOT NULL,
 quotes_json TEXT NOT NULL, location TEXT NOT NULL, explanation TEXT NOT NULL, fix TEXT NOT NULL,
 first_run_id TEXT NOT NULL, last_seen_run_id TEXT NOT NULL, reject_reason TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(project_key,fingerprint),
 FOREIGN KEY(project_key) REFERENCES projects(key) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY, defect_key TEXT NOT NULL, author TEXT NOT NULL,
 text TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(defect_key) REFERENCES defects(key) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS history(id TEXT PRIMARY KEY, defect_key TEXT NOT NULL, at TEXT NOT NULL,
 actor TEXT NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL,
 FOREIGN KEY(defect_key) REFERENCES defects(key) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS saved_filters(id TEXT PRIMARY KEY, project_key TEXT NOT NULL, name TEXT NOT NULL,
 query_json TEXT NOT NULL, FOREIGN KEY(project_key) REFERENCES projects(key) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_key,number DESC);
CREATE INDEX IF NOT EXISTS idx_defects_project ON defects(project_key,status,severity);
CREATE INDEX IF NOT EXISTS idx_history_defect ON history(defect_key,at DESC);
"""


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


class Repository:
    def __init__(self, db_path: str | Path, project_root: Path):
        self.path = Path(db_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.project_root = project_root
        self.storage_root = self.path.parent / "projects"
        self.storage_root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self.migrate()
        self.seed_first_project()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=30, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        with self._lock, self.connect() as connection:
            yield connection
            connection.commit()

    def migrate(self) -> None:
        with self.transaction() as connection:
            connection.executescript(SCHEMA)

    @staticmethod
    def _dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
        return dict(row) if row else None

    def one(self, query: str, values: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        with self.connect() as connection:
            return self._dict(connection.execute(query, values).fetchone())

    def all(self, query: str, values: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self.connect() as connection:
            return [dict(row) for row in connection.execute(query, values).fetchall()]

    def execute(self, query: str, values: tuple[Any, ...] = ()) -> None:
        with self.transaction() as connection:
            connection.execute(query, values)

    def seed_first_project(self) -> None:
        if self.one("SELECT key FROM projects LIMIT 1"):
            return
        self.create_project({
            "key": "CARD", "name": "Уведомление о расходах по карте",
            "description": "Проверка требований карточных уведомлений", "owner": "Владелец продукта",
        })
        source = self.project_root / "docs" / "requirements.md"
        if source.is_file():
            self.add_document_file("CARD", source.name, source.read_bytes())
        context_dir = self.project_root / "examples" / "context"
        types = {"project_passport.md": "passport", "systems.md": "systems", "policies.md": "policies"}
        if context_dir.is_dir():
            for path in sorted(context_dir.iterdir()):
                if path.is_file():
                    self.add_context_file("CARD", types.get(path.name, "other"), path.name, path.read_bytes())

    def create_project(self, data: dict[str, Any]) -> dict[str, Any]:
        key = str(data["key"]).upper()
        created = now_iso()
        settings = data.get("settings") or {
            "default_model": "gemini-3-flash-preview", "batch_size": 12,
            "max_critical": 0, "criteria": [],
        }
        self.execute(
            "INSERT INTO projects(key,name,description,owner,starred,created_at,settings_json) VALUES(?,?,?,?,?,?,?)",
            (key, data["name"], data.get("description", ""), data.get("owner", "—"),
             int(bool(data.get("starred"))), created, json.dumps(settings, ensure_ascii=False)),
        )
        (self.storage_root / key).mkdir(parents=True, exist_ok=True)
        return self.get_project(key) or {}

    def get_project(self, key: str) -> dict[str, Any] | None:
        project = self.one("SELECT * FROM projects WHERE key=?", (key.upper(),))
        if project:
            project["starred"] = bool(project["starred"])
            project["settings"] = json.loads(project.pop("settings_json") or "{}")
            latest = self.one("SELECT * FROM runs WHERE project_key=? AND status='done' ORDER BY number DESC LIMIT 1", (key.upper(),))
            project["latest_run"] = latest
            project["open_critical"] = (self.one(
                "SELECT count(*) AS value FROM defects WHERE project_key=? AND severity='critical' AND status IN ('open','in_progress')",
                (key.upper(),),
            ) or {"value": 0})["value"]
        return project

    def list_projects(self) -> list[dict[str, Any]]:
        return [self.get_project(row["key"]) for row in self.all(
            "SELECT key FROM projects ORDER BY starred DESC, name"
        ) if self.get_project(row["key"])]

    def update_project(self, key: str, data: dict[str, Any]) -> dict[str, Any] | None:
        current = self.get_project(key)
        if not current:
            return None
        settings = data.get("settings", current["settings"])
        self.execute(
            "UPDATE projects SET name=?,description=?,owner=?,settings_json=? WHERE key=?",
            (data.get("name", current["name"]), data.get("description", current["description"]),
             data.get("owner", current["owner"]), json.dumps(settings, ensure_ascii=False), key.upper()),
        )
        return self.get_project(key)

    def delete_project(self, key: str) -> bool:
        if not self.get_project(key):
            return False
        self.execute("DELETE FROM projects WHERE key=?", (key.upper(),))
        shutil.rmtree(self.storage_root / key.upper(), ignore_errors=True)
        return True

    def add_document_file(
        self, project_key: str, filename: str, content: bytes, document_id: str | None = None
    ) -> dict[str, Any]:
        import hashlib

        project_key = project_key.upper()
        uploaded = now_iso()
        with self.transaction() as connection:
            if document_id:
                document = connection.execute(
                    "SELECT * FROM documents WHERE id=? AND project_key=?", (document_id, project_key)
                ).fetchone()
                if not document:
                    raise KeyError(document_id)
                version = connection.execute(
                    "SELECT COALESCE(MAX(version),0)+1 FROM document_versions WHERE document_id=?", (document_id,)
                ).fetchone()[0]
            else:
                document_id = uuid4().hex
                version = 1
                connection.execute(
                    "INSERT INTO documents(id,project_key,name,created_at) VALUES(?,?,?,?)",
                    (document_id, project_key, filename, uploaded),
                )
            version_id = uuid4().hex
            directory = self.storage_root / project_key / "documents" / document_id / f"v{version}"
            directory.mkdir(parents=True, exist_ok=True)
            path = directory / Path(filename).name
            path.write_bytes(content)
            connection.execute(
                "INSERT INTO document_versions VALUES(?,?,?,?,?,?,?)",
                (version_id, document_id, version, Path(filename).name, str(path),
                 hashlib.sha256(content).hexdigest(), uploaded),
            )
        return self.document(document_id) or {}

    def document(self, document_id: str) -> dict[str, Any] | None:
        value = self.one("SELECT * FROM documents WHERE id=?", (document_id,))
        if value:
            value["versions"] = self.all(
                "SELECT id,version,filename,sha256,uploaded_at FROM document_versions WHERE document_id=? ORDER BY version DESC",
                (document_id,),
            )
        return value

    def documents(self, project_key: str) -> list[dict[str, Any]]:
        return [self.document(row["id"]) for row in self.all(
            "SELECT id FROM documents WHERE project_key=? ORDER BY created_at DESC", (project_key.upper(),)
        ) if self.document(row["id"])]

    def add_context_file(self, project_key: str, kind: str, filename: str, content: bytes) -> dict[str, Any]:
        project_key = project_key.upper()
        previous = self.one(
            "SELECT COALESCE(MAX(version),0) AS version FROM context_files WHERE project_key=? AND filename=?",
            (project_key, filename),
        )
        version = int(previous["version"] if previous else 0) + 1
        item_id = uuid4().hex
        directory = self.storage_root / project_key / "context" / item_id
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / Path(filename).name
        path.write_bytes(content)
        uploaded = now_iso()
        self.execute(
            "INSERT INTO context_files VALUES(?,?,?,?,?,?,?)",
            (item_id, project_key, kind, path.name, str(path), version, uploaded),
        )
        return self.one("SELECT * FROM context_files WHERE id=?", (item_id,)) or {}

    def context_files(self, project_key: str) -> list[dict[str, Any]]:
        return self.all("SELECT * FROM context_files WHERE project_key=? ORDER BY uploaded_at DESC", (project_key.upper(),))

    def create_run(self, project_key: str, data: dict[str, Any]) -> dict[str, Any]:
        project_key = project_key.upper()
        with self.transaction() as connection:
            number = connection.execute(
                "SELECT COALESCE(MAX(number),0)+1 FROM runs WHERE project_key=?", (project_key,)
            ).fetchone()[0]
            run_id = uuid4().hex
            connection.execute(
                "INSERT INTO runs(id,project_key,number,document_version_id,model,provider,options_json,status,step,progress) VALUES(?,?,?,?,?,?,?,?,?,?)",
                (run_id, project_key, number, data["document_version_id"], data["model"], data["provider"],
                 json.dumps(data.get("options", {}), ensure_ascii=False), "queued", "В очереди", 0),
            )
        return self.run(run_id) or {}

    def run(self, run_id: str) -> dict[str, Any] | None:
        value = self.one("""SELECT r.*,d.name AS document_name,dv.version AS document_version,dv.path AS document_path
            FROM runs r JOIN document_versions dv ON dv.id=r.document_version_id
            JOIN documents d ON d.id=dv.document_id WHERE r.id=?""", (run_id,))
        if value:
            value["options"] = json.loads(value.pop("options_json") or "{}")
        return value

    def runs(self, project_key: str) -> list[dict[str, Any]]:
        return [self.run(row["id"]) for row in self.all(
            "SELECT id FROM runs WHERE project_key=? ORDER BY number DESC", (project_key.upper(),)
        ) if self.run(row["id"])]

    def update_run(self, run_id: str, **changes: Any) -> None:
        if not changes:
            return
        columns = ",".join(f"{key}=?" for key in changes)
        self.execute(f"UPDATE runs SET {columns} WHERE id=?", (*changes.values(), run_id))

    def add_history(self, defect_key: str, actor: str, action: str, details: str = "") -> None:
        self.execute(
            "INSERT INTO history VALUES(?,?,?,?,?,?)",
            (uuid4().hex, defect_key, now_iso(), actor, action, details),
        )
