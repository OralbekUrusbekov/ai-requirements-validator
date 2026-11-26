import type { Defect } from "../../api/types";
import { Dialog } from "../../components/ui";

export interface RunComparison {
  fixed: Defect[];
  new: Defect[];
  remaining: Defect[];
}

export function CompareRunsDialog({
  comparison,
  onClose,
}: {
  comparison?: RunComparison;
  onClose: () => void;
}) {
  const groups: Array<[keyof RunComparison, string]> = [
    ["fixed", "Исправлено"],
    ["new", "Новое"],
    ["remaining", "Осталось"],
  ];
  return (
    <Dialog open={Boolean(comparison)} title="Сравнение прогонов" onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-3">
        {groups.map(([key, label]) => (
          <section key={key}>
            <h3 className="font-bold">{label}</h3>
            {comparison?.[key].length ? (
              <ul className="mt-2 list-disc space-y-2 pl-5">
                {comparison[key].map((item) => (
                  <li key={item.key}><b className="mono">{item.key}</b> · {item.title}</li>
                ))}
              </ul>
            ) : <p className="mt-2 text-[var(--muted-foreground)]">Нет</p>}
          </section>
        ))}
      </div>
    </Dialog>
  );
}
