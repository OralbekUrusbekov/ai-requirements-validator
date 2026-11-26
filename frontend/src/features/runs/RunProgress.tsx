import type { Run } from "../../api/types";

const steps = [
  "Загрузка",
  "Сегментация",
  "Проверка требований",
  "Проверка набора",
  "Контекст",
  "Отчёт",
];

export function RunProgress({ run }: { run: Run }) {
  const active = Math.min(steps.length - 1, Math.floor(run.progress / (100 / steps.length)));
  return (
    <div className="mt-2 min-w-64" aria-label={`Прогресс ${run.progress}%`}>
      <div className="mb-1 flex justify-between text-xs">
        <span className="max-w-52 truncate">{run.step || steps[active]}</span>
        <b>{run.progress}%</b>
      </div>
      <div className="h-1.5 rounded bg-[var(--muted)]">
        <div className="h-full rounded bg-[var(--primary)]" style={{ width: `${run.progress}%` }} />
      </div>
    </div>
  );
}
