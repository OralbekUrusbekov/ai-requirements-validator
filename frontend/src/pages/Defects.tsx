import { LayoutGrid, List } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, jsonBody } from "../api/client";
import { useDefects } from "../api/hooks";
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
  // На единой странице проекта в URL есть и чужие параметры (например, new=true у прогонов).
  const defectQuery = new URLSearchParams(params);
  defectQuery.delete("new");
  const defects = useDefects(key, defectQuery.toString());
  const toast = useToast();
  const view = params.get("view") || "board";
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

  useEffect(() => {
    const defectKey = params.get("d");
    if (!defectKey) {
      setDetail(undefined);
      return;
    }
    Promise.all([
      api<Defect>(`/defects/${defectKey}`),
      api<Comment[]>(`/defects/${defectKey}/comments`),
      api<DefectHistory[]>(`/defects/${defectKey}/history`),
    ]).then(([defect, commentData, historyData]) => {
      setDetail(defect);
      setComments(commentData);
      setHistory(historyData);
    }).catch((error: Error) => toast.push(error.message, "error"));
  }, [params.get("d")]);

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
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
    await api(`/defects/${defectKey}`, { method: "PATCH", body: jsonBody(value) });
    await defects.refetch();
    if (detail?.key === defectKey) {
      setDetail((current) => current ? { ...current, ...value } : current);
    }
    toast.push("Дефект обновлён");
  }

  async function bulk(value: { status?: string; assignee?: string }) {
    await api("/defects/bulk", {
      method: "POST",
      body: jsonBody({ keys: selected, ...value }),
    });
    setSelected([]);
    await defects.refetch();
    toast.push("Массовое действие выполнено");
  }

  async function addComment(text: string) {
    if (!detail) return;
    const created = await api<Comment>(`/defects/${detail.key}/comments`, {
      method: "POST",
      body: jsonBody({ author: "Текущий пользователь", text }),
    });
    setComments((current) => [...current, created?.id ? created : {
      id: String(Date.now()), defect_key: detail.key, author: "Текущий пользователь",
      text, created_at: new Date().toISOString(),
    }]);
    toast.push("Комментарий добавлен");
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
          selected={selected}
          onSelect={selectDefect}
          onOpen={openDefect}
        />
      )}
      {view === "list" && defects.data && defects.data.total > defects.data.page_size && (
        <div className="mt-4 flex justify-center gap-2">
          <Button disabled={defects.data.page <= 1}>Назад</Button>
          <span className="p-2">Страница {defects.data.page}</span><Button>Далее</Button>
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
