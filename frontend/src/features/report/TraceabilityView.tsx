import type { TraceabilityRow } from "../../api/types";
import { Card, EmptyState, Table } from "../../components/ui";

export function TraceabilityView({ rows }: { rows: TraceabilityRow[] }) {
  if (!rows.length) {
    return <EmptyState title="Матрица пуста" description="Связи не были найдены в последнем прогоне." />;
  }
  return (
    <Card>
      <Table>
        <thead className="bg-[var(--muted)]">
          <tr>
            {[
              "ЦЕЛЬ",
              "ТРЕБОВАНИЯ",
              "КРИТЕРИИ ПРИЁМКИ",
              "API",
            ].map((label) => <th className="p-3" key={label}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const missing = row.status === "missing";
            return (
              <tr className={missing ? "border-t bg-red-50 text-red-900 dark:bg-red-950/20" : "border-t"} key={index}>
                <td className="p-3 font-medium">{row.goal}</td>
                <td className="mono p-3">{row.requirement_ids.join(", ") || "Не покрыто"}</td>
                <td className="mono p-3">{row.acceptance_ids.join(", ") || "Не покрыто"}</td>
                <td className="mono p-3">{row.api_ids.join(", ") || "Не покрыто"}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
