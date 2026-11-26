import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { Requirement } from "../../api/types";
import { Input, Skeleton } from "../ui";

interface SearchResults {
  projects: Array<{ key: string; name: string }>;
  defects: Array<{ key: string; title: string; project_key: string }>;
  requirements: Array<Requirement & { project_key: string }>;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>();
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(undefined);
      return;
    }
    const id = ++request.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const value = await api<SearchResults>(`/search?q=${encodeURIComponent(query)}`);
        if (request.current === id) setResults(value);
      } finally {
        if (request.current === id) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  function close() {
    setQuery("");
    setResults(undefined);
  }

  const count =
    (results?.projects.length ?? 0) +
    (results?.defects.length ?? 0) +
    (results?.requirements.length ?? 0);

  return (
    <div className="relative max-w-xl flex-1">
      <Search className="absolute left-3 top-2.5 h-5 text-[var(--muted-foreground)]" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="pl-10"
        placeholder="Поиск: проекты, CARD-17, R-05…"
        aria-label="Глобальный поиск"
      />
      {query.length >= 2 && (
        <div className="absolute top-12 z-50 max-h-96 w-full overflow-auto rounded-lg border bg-[var(--popover)] p-2 shadow-xl">
          {loading && <Skeleton className="h-24" />}
          {!loading && count === 0 && (
            <p className="p-4 text-center text-sm text-[var(--muted-foreground)]">
              Ничего не найдено
            </p>
          )}
          {results?.projects.map((item) => (
            <Link
              key={item.key}
              to={`/projects/${item.key}`}
              onClick={close}
              className="block rounded-lg p-2 hover:bg-[var(--muted)]"
            >
              <b className="mono text-[var(--primary)]">{item.key}</b> · {item.name}
            </Link>
          ))}
          {results?.defects.map((item) => (
            <Link
              key={item.key}
              to={`/projects/${item.project_key}/defects?d=${item.key}`}
              onClick={close}
              className="block rounded-lg p-2 hover:bg-[var(--muted)]"
            >
              <b className="mono text-[var(--primary)]">{item.key}</b> · {item.title}
            </Link>
          ))}
          {results?.requirements.map((item) => (
            <Link
              key={`${item.project_key}-${item.report_id}`}
              to={`/projects/${item.project_key}/requirements#${item.report_id}`}
              onClick={close}
              className="block rounded-lg p-2 hover:bg-[var(--muted)]"
            >
              <b className="mono text-[var(--primary)]">{item.report_id}</b> · {item.short_text}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
