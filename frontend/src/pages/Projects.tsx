import { Plus, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useProjects } from "../api/hooks";
import { PageTitle } from "../components/Layout";
import { Badge, Button, EmptyState, ErrorState, Skeleton, Table, useToast } from "../components/ui";
import { CreateProjectDialog } from "../features/projects/CreateProjectDialog";

function decisionClass(decision?: string): string {
  if (decision === "Да") return "bg-green-100 text-green-900";
  if (decision === "Нет") return "bg-red-100 text-red-900";
  return "bg-amber-100 text-amber-900";
}

export function Projects() {
  const [params, setParams] = useSearchParams();
  const projects = useProjects();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(params.get("create") === "true");

  useEffect(() => setCreateOpen(params.get("create") === "true"), [params]);

  function closeDialog() {
    setCreateOpen(false);
    setParams({});
  }

  async function toggleStar(key: string) {
    try {
      await api(`/projects/${key}/star`, { method: "POST" });
      await projects.refetch();
    } catch (error) {
      toast.push((error as Error).message, "error");
    }
  }

  return (
    <>
      <PageTitle
        title="Все проекты"
        subtitle="Статическая проверка требований · ISO/IEC/IEEE 29148, IEEE 830"
        actions={
          <Button onClick={() => setParams({ create: "true" })}>
            <Plus size={18} />Создать проект
          </Button>
        }
      />

      {projects.isLoading && <Skeleton className="h-72" />}
      {projects.error && <ErrorState error={projects.error} retry={() => projects.refetch()} />}
      {projects.data && projects.data.length === 0 && (
        <EmptyState
          title="Проектов пока нет"
          description="Создайте проект, загрузите требования и запустите первую проверку."
          action={<Button onClick={() => setParams({ create: "true" })}>Создать проект</Button>}
        />
      )}
      {projects.data && projects.data.length > 0 && (
        <Table>
          <thead className="bg-[var(--muted)]">
            <tr>
              <th className="p-3" aria-label="Избранное" />
              <th className="p-3">КЛЮЧ</th>
              <th className="p-3">НАЗВАНИЕ</th>
              <th className="p-3">ВЛАДЕЛЕЦ</th>
              <th className="p-3">ПОСЛЕДНИЙ ПРОГОН</th>
              <th className="p-3">РЕШЕНИЕ</th>
              <th className="p-3">ОТКРЫТЫЕ CRITICAL</th>
            </tr>
          </thead>
          <tbody>
            {projects.data.map((project) => (
              <tr className="border-t" key={project.key}>
                <td className="p-3">
                  <button
                    type="button"
                    aria-label={project.starred ? "Убрать из избранного" : "Добавить в избранное"}
                    className={project.starred ? "text-amber-500" : "text-gray-400"}
                    onClick={() => toggleStar(project.key)}
                  >
                    <Star size={19} fill={project.starred ? "currentColor" : "none"} />
                  </button>
                </td>
                <td className="p-3">
                  <Link className="mono font-bold text-[var(--primary)]" to={`/projects/${project.key}`}>
                    {project.key}
                  </Link>
                </td>
                <td className="p-3">
                  <Link className="font-semibold hover:underline" to={`/projects/${project.key}`}>
                    {project.name}
                  </Link>
                  <small className="block text-[var(--muted-foreground)]">{project.description}</small>
                </td>
                <td className="p-3">{project.owner || "—"}</td>
                <td className="p-3 text-[var(--primary)]">
                  {project.latest_run?.started_at
                    ? new Date(project.latest_run.started_at).toLocaleString("ru")
                    : "Нет прогонов"}
                </td>
                <td className="p-3">
                  {project.latest_run?.decision ? (
                    <Badge className={decisionClass(project.latest_run.decision)}>
                      {project.latest_run.decision}
                    </Badge>
                  ) : "—"}
                </td>
                <td className="p-3 font-bold text-red-600">{project.open_critical}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <CreateProjectDialog
        open={createOpen}
        onClose={closeDialog}
        onCreated={() => projects.refetch()}
      />
    </>
  );
}
