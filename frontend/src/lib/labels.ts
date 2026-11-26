/** Russian labels for enum values coming from the agent and the API. */

export const criterionLabels: Record<string, string> = {
  // ISO/IEC/IEEE 29148 §5.2.5 — individual requirement
  necessary: "Необходимость",
  appropriate: "Уместность",
  unambiguous: "Однозначность",
  complete: "Полнота",
  singular: "Атомарность",
  feasible: "Осуществимость",
  verifiable: "Проверяемость",
  correct: "Корректность",
  conforming: "Соответствие форме",
  // §5.2.6 / IEEE 830 §4.3 — set of requirements
  consistent: "Непротиворечивость",
  comprehensible: "Понятность",
  able_to_be_validated: "Валидируемость",
  ranked_importance_stability: "Приоритет и стабильность",
  modifiable: "Модифицируемость",
  traceable: "Трассируемость",
  // context validation
  goal_not_covered: "Цель не покрыта",
  unjustified_requirement: "Нет связи с целью",
  scope_conflict: "Конфликт со скоупом",
  constraint_conflict: "Конфликт с ограничением",
  term_conflict: "Конфликт терминов",
  system_conflict: "Конфликт с системой",
  policy_conflict: "Конфликт с политикой",
  domain: "Доменный риск",
};

/** Criteria offered in filters, in the order analysts expect. */
export const filterCriteria = [
  "unambiguous",
  "verifiable",
  "complete",
  "consistent",
  "singular",
  "traceable",
  "feasible",
  "correct",
  "necessary",
  "appropriate",
  "conforming",
];

export const defectTypeLabels: Record<string, string> = {
  internal: "Внутренний",
  context: "Конфликт с контекстом",
  domain: "Доменный риск",
};

export const severityLabels: Record<string, string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
};

export const contextKeyLabels: Record<string, string> = {
  goals: "Цели",
  scope_in: "Скоуп",
  scope_out: "Вне скоупа",
  constraints: "Ограничения",
  glossary: "Глоссарий",
  systems: "Системы",
  policies: "Политики",
};

export const routeLabels: Record<string, string> = {
  runs: "Прогоны",
  defects: "Дефекты",
  requirements: "Требования",
  traceability: "Трассируемость",
  context: "Контекст",
  testcases: "Тест-кейсы",
  settings: "Настройки",
};

export function criterionLabel(value: string | undefined | null): string {
  if (!value) return "—";
  return criterionLabels[value] ?? value;
}

export function defectTypeLabel(value: string | undefined | null): string {
  if (!value) return "—";
  return defectTypeLabels[value] ?? value;
}

/** Renders any extracted-context value (string, list, or object with text/quote) as plain text. */
export function contextValueText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(contextValueText).filter(Boolean).join("; ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "value", "name", "term", "title", "quote", "description"]) {
      if (typeof record[key] === "string" && record[key]) {
        const extra =
          key !== "quote" && typeof record.definition === "string" ? ` — ${record.definition}` : "";
        return `${record[key]}${extra}`;
      }
    }
    return Object.values(record).map(contextValueText).filter(Boolean).join(", ");
  }
  return String(value);
}
