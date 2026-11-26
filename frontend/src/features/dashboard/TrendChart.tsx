import type { DashboardData } from "../../api/types";
import { Card } from "../../components/ui";

export function TrendChart({ rows }: { rows: DashboardData["runs_trend"] }) {
  const maximum = Math.max(1, ...rows.map((row) => row.findings));
  return (
    <Card className="mt-5">
      <h2 className="font-bold">Динамика прогонов</h2>
      <div className="mt-5 flex h-56 items-end gap-5" role="img" aria-label="Динамика нарушений">
        {rows.map((row) => (
          <div className="flex h-full flex-1 flex-col items-center justify-end" key={row.number}>
            <b>{row.findings}</b>
            <div
              className="mt-1 w-full max-w-24 rounded-t bg-[var(--primary)]"
              style={{ height: `${Math.max(12, (row.findings / maximum) * 160)}px` }}
            />
            <small className="mt-2 text-center">
              #{row.number}
              <br />
              {new Date(row.date).toLocaleDateString("ru")}
            </small>
          </div>
        ))}
      </div>
    </Card>
  );
}
