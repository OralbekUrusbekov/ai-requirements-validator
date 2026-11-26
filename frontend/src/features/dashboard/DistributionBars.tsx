import { criterionLabel } from "../../lib/labels";
import { Card } from "../../components/ui";

const labels: Record<string, string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
  open: "Открыт",
  in_progress: "В работе",
  fixed: "Исправлен",
  rejected: "Отклонён",
  complete: "Полнота",
  consistent: "Согласованность",
  verifiable: "Проверяемость",
  unambiguous: "Однозначность",
};

interface DistributionBarsProps {
  title: string;
  data: Record<string, number>;
  color?: string;
}

export function DistributionBars({ title, data, color = "var(--primary)" }: DistributionBarsProps) {
  const maximum = Math.max(1, ...Object.values(data));
  return (
    <Card>
      <h2 className="mb-4 font-bold">{title}</h2>
      <div className="grid gap-3">
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{labels[key] ?? criterionLabel(key)}</span>
              <b>{value}</b>
            </div>
            <div className="h-2 rounded bg-[var(--muted)]">
              <div
                className="bar h-full rounded"
                style={{ width: `${(value / maximum) * 100}%`, background: color }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
