import { GitCompare, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, jsonBody } from "../api/client";
import { useConfig, useDocuments, useRuns } from "../api/hooks";
import type { Run } from "../api/types";
import { PageTitle } from "../components/Layout";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  Skeleton,
  Table,
  useToast,
} from "../components/ui";
import { CompareRunsDialog, type RunComparison } from "../features/runs/CompareRunsDialog";
import { NewRunPanel, type NewRunValues } from "../features/runs/NewRunPanel";
import { RunProgress } from "../features/runs/RunProgress";

function statusBadge(run: Run) {
  const classes = {
    error: "bg-red-100 text-red-800",
    done: "bg-green-100 text-green-800",
    running: "bg-amber-100 text-amber-900",
    queued: "bg-gray-100 text-gray-800",
  };
  const labels = { error: "Ошибка", done: "Завершён", running: "Выполняется", queued: "В очереди" };
  return <Badge className={classes[run.status]}>{labels[run.status]}</Badge>;
}

/** Провайдер выбирается по модели: иначе gpt-4o-mini ушла бы в Gemini и прогон упал бы с ошибкой. */
function providerForModel(model: string, fallback?: string) {
  if (model.startsWith("gpt") || model.startsWith("o1") || model.startsWith("o3")) return "openai";
  if (model.startsWith("gemini")) return "gemini";
  if (model.startsWith("mock")) return "mock";
  return fallback;
}

export function Runs() {
  const { key } = useParams();
  const [params, setParams] = useSearchParams();
  const runs = useRuns(key);
  const documents = useDocuments(key);
  const config = useConfig();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<RunComparison>();
  const panelOpen = params.get("new") === "true";

  async function upload(file: File, documentId?: string) {
    const body = new FormData();
    body.append("file", file);
    if (documentId) body.append("document_id", documentId);
    try {
      await api(`/projects/${key}/documents`, { method: "POST", body });
      await documents.refetch();
      toast.push("Документ загружен");
    } catch (error) {
      toast.push((error as Error).message, "error");
    }
  }

  async function start(values: NewRunValues) {
    const version = values.document_version_id;
    if (!version) {
      toast.push("Сначала загрузите документ", "error");
      return;
    }
    const model = values.model || config.data?.model || "";
    try {
      await api(`/projects/${key}/runs`, {
        method: "POST",
        body: jsonBody({
          ...values,
          document_version_id: version,
          provider: providerForModel(model, config.data?.provider),
          model,
        }),
      });
      setParams({});
      await runs.refetch();
      toast.push("Проверка поставлена в очередь");
    } catch (error) {
      toast.push((error as Error).message, "error");
    }
  }

  async function compareRuns() {
    if (selected.length !== 2) return;
    // Базой всегда служит более ранний прогон, иначе «исправлено» и «новое» поменяются местами.
    const number = (id: string) => runs.data?.find((run) => run.id === id)?.number ?? 0;
    const [older, newer] = [...selected].sort((a, b) => number(a) - number(b));
    try {
      setComparison(await api<RunComparison>(`/runs/compare?a=${older}&b=${newer}`));
    } catch (error) {
      toast.push((error as Error).message, "error");
    }
  }

  function toggleRun(id: string, checked: boolean) {
    setSelected((current) => (checked ? [...current, id] : current.filter((item) => item !== id)));
  }

  return (
    <>
      <PageTitle
        title="Прогоны проверки"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={selected.length !== 2}
              className="bg-transparent text-[var(--foreground)]"
              onClick={compareRuns}
            >
              <GitCompare />Сравнить выбранные ({selected.length}/2)
            </Button>
            <Button onClick={() => setParams({ new: "true" })}><Plus />Новая проверка</Button>
          </div>
        }
      />

      {panelOpen && (
        <NewRunPanel
          documents={documents.data ?? []}
          config={config.data}
          onUpload={upload}
          onStart={start}
          onClose={() => setParams({})}
        />
      )}

      {runs.isLoading && <Skeleton className="h-72" />}
      {runs.error && <ErrorState error={runs.error} retry={() => runs.refetch()} />}
      {runs.data?.length === 0 && (
        <EmptyState
          title="Прогонов пока нет"
          description="Загрузите документ и запустите проверку требований."
          action={<Button onClick={() => setParams({ new: "true" })}>Новая проверка</Button>}
        />
      )}
      {runs.data && runs.data.length > 0 && (
        <Table>
          <thead className="bg-[var(--muted)]">
            <tr>
              {["", "#", "ДОКУМЕНТ", "МОДЕЛЬ", "СТАТУС", "ДЛИТ.", "ТРЕБ.", "НАРУШЕНИЙ", "COVERAGE", "РЕШЕНИЕ", "АГЕНТ"].map((label) => (
                <th className="p-3" key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.data.map((run) => (
              <tr className="border-t align-top" key={run.id}>
                <td className="p-3">
                  <Checkbox
                    checked={selected.includes(run.id)}
                    disabled={run.status !== "done" || (!selected.includes(run.id) && selected.length >= 2)}
                    onChange={(event) => toggleRun(run.id, event.target.checked)}
                    aria-label={`Выбрать прогон ${run.number}`}
                  />
                </td>
                <td className="p-3">
                  <Link
                    className="mono font-bold text-[var(--primary)]"
                    to={`/projects/${key}/runs/${run.id}`}
                  >
                    #{run.number}
                  </Link>
                </td>
                <td className="p-3">
                  <b>{run.document_name}</b>
                  <small className="block text-[var(--muted-foreground)]">
                    v{run.document_version} · {run.started_at ? new Date(run.started_at).toLocaleDateString("ru") : "—"}
                  </small>
                </td>
                <td className="mono p-3">{run.model}</td>
                <td className="p-3">
                  {statusBadge(run)}
                  {run.status === "running" && <RunProgress run={run} />}
                  {run.status === "error" && <small className="mt-1 block max-w-xs text-red-700">{run.error}</small>}
                </td>
                <td className="p-3">{run.duration == null ? "—" : `${run.duration} с`}</td>
                <td className="p-3">{run.requirements_count}</td>
                <td className="p-3 font-bold">{run.findings_count}</td>
                <td className="p-3">{run.coverage == null ? "—" : `${run.coverage}%`}</td>
                <td className="p-3">{run.decision || "—"}</td>
                <td className="mono p-3">{run.agent_version?.split("+")[1]?.slice(0, 8) || "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <CompareRunsDialog comparison={comparison} onClose={() => setComparison(undefined)} />
    </>
  );
}
