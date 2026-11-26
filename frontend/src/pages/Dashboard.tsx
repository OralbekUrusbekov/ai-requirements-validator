import { Play } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useDashboard, useProject } from "../api/hooks";
import { PageTitle } from "../components/Layout";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "../components/ui";
import { DistributionBars } from "../features/dashboard/DistributionBars";
import { TrendChart } from "../features/dashboard/TrendChart";

export function Dashboard() {
  const { key } = useParams();
  const project = useProject(key);
  const dashboard = useDashboard(key);

  if (project.isLoading || dashboard.isLoading) return <Skeleton className="h-96" />;
  if (project.error || dashboard.error) {
    return <ErrorState error={(project.error || dashboard.error) as Error} />;
  }

  const data = dashboard.data!;
  const kpis = [
    { label: "РЕШЕНИЕ", value: data.kpis.decision || "—", decision: true },
    { label: "ТРЕБОВАНИЙ", value: data.kpis.requirements },
    { label: "ОТКРЫТЫЕ ДЕФЕКТЫ", value: data.kpis.open_defects },
    { label: "ОТКРЫТЫЕ CRITICAL", value: data.kpis.open_critical, critical: true },
    { label: "COVERAGE", value: data.kpis.coverage == null ? "—" : `${data.kpis.coverage}%` },
  ];

  return (
    <>
      <PageTitle
        title={project.data?.name || key!}
        subtitle={`${key} · ${project.data?.description} · владелец ${project.data?.owner}`}
        actions={
          <Link to={`/projects/${key}/runs?new=true`}>
            <Button><Play size={17} />Запустить проверку</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((item) => (
          <Card key={item.label}>
            <small className="text-[var(--muted-foreground)]">{item.label}</small>
            <div className={item.critical ? "mt-2 text-3xl font-bold text-red-600" : "mt-2 text-3xl font-bold"}>
              {item.decision ? (
                <Badge className="bg-amber-100 px-3 py-2 text-amber-900">{item.value}</Badge>
              ) : item.value}
            </div>
          </Card>
        ))}
      </div>

      {data.runs_trend.length ? (
        <>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <DistributionBars
              title="По серьёзности"
              data={data.by_severity}
              color="var(--destructive)"
            />
            <DistributionBars title="По статусу" data={data.by_status} />
            <DistributionBars
              title="По критериям"
              data={data.by_criterion}
              color="var(--gold)"
            />
          </div>
          <TrendChart rows={data.runs_trend} />
        </>
      ) : (
        <div className="mt-5">
          <EmptyState
            title="Прогонов пока нет"
            description="Запустите первую статическую проверку документа проекта."
            action={
              <Link to={`/projects/${key}/runs?new=true`}>
                <Button>Запустить первую проверку</Button>
              </Link>
            }
          />
        </div>
      )}
    </>
  );
}
