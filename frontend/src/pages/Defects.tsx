import { LayoutGrid, List } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, jsonBody } from "../api/client";
import { useDefects, useRuns } from "../api/hooks";
import type {
  Comment,
  Defect,
  DefectHistory,
  DefectStatus,
  Member,
  SavedFilter,
} from "../api/types";
import { PageTitle } from "../components/Layout";
import { Button, EmptyState, ErrorState, Select, Skeleton, useToast } from "../components/ui";
import { DefectBoard } from "../features/defects/DefectBoard";
import { DefectFilters } from "../features/defects/DefectFilters";
import { DefectList } from "../features/defects/DefectList";
import { DefectSheet } from "../features/defects/DefectSheet";

export function Defects() {
  const { key } = useParams();
  const [params, setParams] = useSearchParams();
  // В API уходят только фильтры, сортировка и страница — не открытый дефект и не вид.
  const query = new URLSearchParams(params);
  query.delete("d");
  query.delete("view");
  const view = params.get("view") || "board";
  if (view === "list" && !query.has("sort")) query.set("sort", "number:asc");
  const defects = useDefects(key, query.toString());
  const runs = useRuns(key);
  const toast = useToast();
  const page = Number(params.get("page") || 1);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Defect>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<DefectHistory[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [filters, setFilters] = useState<SavedFilter[]>([]);

  useEffect(() => {
    if (!key) return;
    Promise.all([
      api<Member[]>(`/projects/${key}/members`),
      api<SavedFilter[]>(`/projects/${key}/filters`),
    ]).then(([memberData, filterData]) => {
      setMembers(memberData);
      setFilters(filterData);
    }).catch((error: Error) => toast.push(error.message, "error"));
  }, [key]);

  async function loadDetail(defectKey: string) {
    const [defect, commentData, historyData] = await Promise.all([
      api<Defect>(`/defects/${defectKey}`),
      api<Comment[]>(`/defects/${defectKey}/comments`),
      api<DefectHistory[]>(`/defects/${defectKey}/history`),
    ]);
    setDetail(defect);
    setComments(commentData);
    setHistory(historyData);
  }

  useEffect(() => {
    const defectKey = params.get("d");
    if (!defectKey) {
      setDetail(undefined);
      return;
    }
    loadDetail(defectKey).catch((error: Error) => toast.push(error.message, "error"));
  }, [params.get("d")]);

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    // Любой новый фильтр или сортировка начинается с первой страницы.
    if (!["d", "page", "view"].includes(name)) next.delete("page");
    setParams(next);
  }

  function openDefect(defectKey: string) {
    setParam("d", defectKey);
  }

  function selectDefect(defectKey: string, checked: boolean) {
    setSelected((current) => checked
      ? [...current, defectKey]
      : current.filter((item) => item !== defectKey));
  }

  async function patchDefect(defectKey: string, value: Partial<Defect>) {
    try {
      await api(`/defects/${defectKey}`, { method: "PATCH", body: jsonBody(value) });
      await defects.refetch();
      // Перечитываем дефект целиком, чтобы обновилась и история изменений.
      if (detail?.key === defectKey) await loadDetail(defectKey);
      toast.push("Дефект обновлён");
    } catch (error) {
      toast.push((error as Error).message, "error");
    }
  }

  async function bulk(value: { status?: string; assignee?: string }) {
    try {
      await api("/defects/bulk", {
        method: "POST",
        body: jsonBody({ keys: selected, ...value }),
      });
      setSelected([]);
      await defects.refetch();
      toast.push("Массовое действие выполнено");
    } catch (error) {
      toast.push((error as Error).message, "error");
    }
  }

  async function addComment(text: string) {
    if (!detail) return;
    try {
      await api<Comment>(`/defects/${detail.key}/comments`, {
        method: "POST",
        body: jsonBody({ author: "Текущий пользователь", text }),
      });
      await loadDetail(detail.key);
      toast.push("Комментарий добавлен");
    } catch (error) {
      toast.push((error as Error).message, "error");
    }
  }

  async function saveFilter() {
    if (!key) return;
    const name = `Фильтр ${filters.length + 1}`;
    await api(`/projects/${key}/filters`, {
      method: "POST",
      body: jsonBody({ name, query: Object.fromEntries(params) }),
    });
    setFilters((current) => [...current, {
      id: String(Date.now()), project_key: key, name, query: Object.fromEntries(params),
    }]);
    toast.push("Фильтр сохранён");
  }

  const items = defects.data?.items ?? [];
  return (
    <>
      <PageTitle
        title="Дефекты"
        subtitle={`${defects.data?.total ?? 0} найдено`}
        actions={
          <div className="flex rounded-lg border p-1">
            <Button
              className={view === "board" ? "border-0" : "border-0 bg-transparent text-[var(--foreground)]"}
              onClick={() => setParam("view", "board")}
            >
              <LayoutGrid size={17} />Доска
            </Button>
            <Button
              className={view === "list" ? "border-0" : "border-0 bg-transparent text-[var(--foreground)]"}
              onClick={() => setParam("view", "list")}
            >
              <List size={17} />Список
            </Button>
          </div>
        }
      />
      <DefectFilters
        params={params}
        members={members}
        runs={runs.data ?? []}
        saved={filters}
        onChange={setParam}
        onReset={() => setParams(view === "list" ? { view: "list" } : {})}
        onSave={saveFilter}
        onApplySaved={(filter) => setParams({ ...filter.query, view })}
      />
      {selected.length > 0 && (
        <div className="sticky top-20 z-20 mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-[var(--primary-deep)] p-3 text-white shadow-lg">
          <b>Выбрано: {selected.length}</b>
          <Select
            className="w-44 text-[var(--foreground)]"
            defaultValue=""
            onChange={(event) => event.target.value && bulk({ status: event.target.value })}
          >
            <option value="">Сменить статус…</option>
            <option value="open">Открыт</option><option value="in_progress">В работе</option>
            <option value="fixed">Исправлен</option><option value="rejected">Отклонён</option>
          </Select>
          <Select
            className="w-48 text-[var(--foreground)]"
            defaultValue=""
            onChange={(event) => event.target.value && bulk({ assignee: event.target.value })}
          >
            <option value="">Назначить…</option>
            {members.map((member) => <option key={member.name}>{member.name}</option>)}
          </Select>
          <Button className="ml-auto bg-white/10" onClick={() => setSelected([])}>Отменить выбор</Button>
        </div>
      )}
      {defects.isLoading && <Skeleton className="h-96" />}
      {defects.error && <ErrorState error={defects.error} retry={() => defects.refetch()} />}
      {!defects.isLoading && !defects.error && items.length === 0 && (
        <EmptyState
          title="Дефекты не найдены"
          description="Измените фильтры или запустите проверку требований."
        />
      )}
      {items.length > 0 && view === "board" && (
        <DefectBoard
          items={items}
          selected={selected}
          onSelect={selectDefect}
          onOpen={openDefect}
          onMove={(defectKey, status) => patchDefect(defectKey, { status })}
        />
      )}
      {items.length > 0 && view === "list" && (
        <DefectList
          items={items}
          sort={query.get("sort") ?? "number:asc"}
          onSort={(value) => setParam("sort", value)}
          selected={selected}
          onSelect={selectDefect}
          onOpen={openDefect}
        />
      )}
      {view === "list" && defects.data && defects.data.total > defects.data.page_size && (
        <div className="mt-4 flex justify-center gap-2">
          <Button disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>Назад</Button>
          <span className="p-2">
            Страница {page} из {Math.ceil(defects.data.total / defects.data.page_size)}
          </span>
          <Button
            disabled={page * defects.data.page_size >= defects.data.total}
            onClick={() => setParam("page", String(page + 1))}
          >
            Далее
          </Button>
        </div>
      )}
      <DefectSheet
        defect={detail}
        members={members}
        comments={comments}
        history={history}
        onClose={() => setParam("d", "")}
        onPatch={(value) => detail ? patchDefect(detail.key, value) : Promise.resolve()}
        onComment={addComment}
      />
    </>
  );
}
