import type { TestCase } from "../../api/types";
import { Card, EmptyState } from "../../components/ui";

export function TestCaseGrid({ items }: { items: TestCase[] }) {
  if (!items.length) {
    return (
      <EmptyState
        title="Тест-кейсы не генерировались"
        description="Включите опцию «Генерировать тест-кейсы» при следующем прогоне."
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((testCase) => (
        <Card key={testCase.id}>
          <div className="flex justify-between gap-3">
            <b className="mono">{testCase.id}</b>
            <span className="mono text-[var(--primary)]">{testCase.requirement_ids.join(", ")}</span>
          </div>
          <p className="mt-3"><b>Проверка:</b> {testCase.preconditions.join("; ")}</p>
          <ol className="my-3 list-decimal space-y-1 pl-5">
            {testCase.steps.map((step, index) => <li key={index}>{step}</li>)}
          </ol>
          <p className="rounded bg-green-50 p-3 text-green-900 dark:bg-green-950/30 dark:text-green-100">
            ✓ {testCase.expected_result}
          </p>
          {testCase.boundary_values.length > 0 && (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              Границы: {testCase.boundary_values.join("; ")}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
