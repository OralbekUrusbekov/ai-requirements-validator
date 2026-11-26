import type {
  ApiConfig,
  Comment,
  ContextFile,
  DashboardData,
  Defect,
  DefectHistory,
  DefectStatus,
  Document,
  Member,
  Project,
  Report,
  Requirement,
  Run,
  SavedFilter,
  SearchResults,
  TestCase,
  TraceabilityRow,
} from "./types";

const dates = ["2026-11-08T09:30:00Z", "2026-11-18T10:20:00Z", "2026-11-25T16:45:00Z"];
const criteria = [
  "complete",
  "consistent",
  "verifiable",
  "unambiguous",
  "feasible",
  "traceable",
];
const titles = [
  "Не определена граница времени обработки",
  "Пример противоречит правилу расчёта",
  "Не описан отрицательный сценарий",
  "Термин допускает несколько толкований",
  "Отсутствует критерий приёмки",
  "Тип поля различается между разделами",
  "Не указан источник измерения метрики",
  "Операция не связана с целью проекта",
];

export const mockRuns: Run[] = [
  {
    id: "mock-run-1",
    project_key: "CARD",
    number: 1,
    document_version_id: "card-v1",
    document_name: "requirements.md",
    document_version: 1,
    model: "gemini-2.5-flash",
    provider: "gemini",
    options: { use_context: false, tests: false },
    status: "done",
    step: "Отчёт",
    progress: 100,
    started_at: dates[0],
    finished_at: "2026-11-08T09:31:44Z",
    agent_version: "0.1.0+41c7a2e",
    requirements_count: 24,
    findings_count: 32,
    coverage: 81,
    decision: "Нет",
    duration: 104,
  },
  {
    id: "mock-run-2",
    project_key: "CARD",
    number: 2,
    document_version_id: "card-v2",
    document_name: "requirements.md",
    document_version: 2,
    model: "gemini-3-flash-preview",
    provider: "gemini",
    options: { use_context: true, tests: false, domain_check: true },
    status: "done",
    step: "Отчёт",
    progress: 100,
    started_at: dates[1],
    finished_at: "2026-11-18T10:22:13Z",
    agent_version: "0.1.0+68ba19d",
    requirements_count: 27,
    findings_count: 25,
    coverage: 91,
    decision: "С оговорками",
    duration: 113,
  },
  {
    id: "mock-run-3",
    project_key: "CARD",
    number: 3,
    document_version_id: "card-v3",
    document_name: "requirements.md",
    document_version: 3,
    model: "gemini-3-flash-preview",
    provider: "gemini",
    options: { use_context: true, tests: true, domain_check: true },
    status: "done",
    step: "Отчёт",
    progress: 100,
    started_at: dates[2],
    finished_at: "2026-11-25T16:47:04Z",
    agent_version: "0.1.0+b806f4c",
    requirements_count: 31,
    findings_count: 18,
    coverage: 96,
    decision: "С оговорками",
    duration: 139,
  },
];

export const mockProjects: Project[] = [
  {
    key: "CARD",
    name: "Уведомление о расходах по карте",
    description: "Контроль требований сервиса уведомлений",
    owner: "Айгерим Садыкова",
    starred: true,
    created_at: dates[0],
    settings: {
      default_model: "gemini-3-flash-preview",
      batch_size: 12,
      max_critical: 0,
      criteria,
    },
    latest_run: mockRuns[2],
    open_critical: 4,
  },
  {
    key: "PAY",
    name: "Платёжный шлюз",
    description: "Каталог требований к обработке переводов",
    owner: "Данияр Ким",
    starred: false,
    created_at: dates[1],
    settings: {
      default_model: "gemini-2.5-flash",
      batch_size: 10,
      max_critical: 0,
      criteria,
    },
    latest_run: null,
    open_critical: 0,
  },
];

export const mockDocuments: Document[] = [
  {
    id: "card-document",
    project_key: "CARD",
    name: "requirements.md",
    created_at: dates[0],
    versions: [1, 2, 3].map((version) => ({
      id: `card-v${version}`,
      version,
      filename: `requirements-v${version}.md`,
      sha256: `demo-sha256-${version}`,
      uploaded_at: dates[version - 1],
    })),
  },
];

const statuses: DefectStatus[] = ["open", "in_progress", "fixed", "rejected"];
export const mockDefects: Defect[] = Array.from({ length: 40 }, (_, index) => {
  const number = index + 1;
  const status = statuses[index % statuses.length];
  const severity = index % 7 === 0 ? "critical" : index % 3 === 0 ? "minor" : "major";
  const criterion = criteria[index % criteria.length];
  return {
    key: `CARD-${number}`,
    project_key: "CARD",
    number,
    fingerprint: `fingerprint-${number}`,
    title: titles[index % titles.length],
    severity,
    criterion,
    type: index % 9 === 0 ? "context" : index % 8 === 0 ? "domain" : "internal",
    status,
    assignee: index % 5 === 0 ? undefined : index % 2 ? "Мария Ким" : "Илья Волков",
    requirement_ids: [`R-${String((index % 31) + 1).padStart(2, "0")}`],
    quotes: [`Система должна обработать событие в установленный срок ${number}.`],
    location: `Функциональные требования, строка ${20 + number}`,
    explanation: `Формулировка не содержит достаточно данных для однозначной проверки (${number}).`,
    fix: "Уточнить условие, измеримый результат, границы и способ проверки.",
    first_run_id: "mock-run-1",
    last_seen_run_id: index < 30 ? "mock-run-3" : "mock-run-2",
    reject_reason: status === "rejected" ? "Подтверждено владельцем продукта." : undefined,
    comments_count: index % 4,
    created_at: dates[0],
    updated_at: dates[index % dates.length],
  };
});

export const mockMembers: Member[] = [
  { name: "Айгерим Садыкова", role: "Аналитик" },
  { name: "Мария Ким", role: "Тестировщик" },
  { name: "Илья Волков", role: "Архитектор" },
];

export const mockContext: ContextFile[] = [
  {
    id: "context-passport",
    project_key: "CARD",
    type: "passport",
    filename: "project_passport.md",
    path: "examples/context/project_passport.md",
    version: 1,
    uploaded_at: dates[1],
  },
  {
    id: "context-systems",
    project_key: "CARD",
    type: "systems",
    filename: "systems.md",
    path: "examples/context/systems.md",
    version: 1,
    uploaded_at: dates[1],
  },
  {
    id: "context-policies",
    project_key: "CARD",
    type: "policies",
    filename: "policies.md",
    path: "examples/context/policies.md",
    version: 1,
    uploaded_at: dates[1],
  },
];

export const mockDashboard: DashboardData = {
  kpis: {
    decision: "С оговорками",
    requirements: 31,
    open_defects: 20,
    open_critical: 4,
    coverage: 96,
  },
  by_severity: { critical: 6, major: 22, minor: 12 },
  by_status: { open: 10, in_progress: 10, fixed: 10, rejected: 10 },
  by_criterion: { complete: 9, consistent: 8, verifiable: 7, unambiguous: 6 },
  runs_trend: mockRuns.map((run) => ({
    number: run.number,
    date: run.started_at ?? "",
    findings: run.findings_count,
  })),
};

export const mockConfig: ApiConfig = {
  provider: "mock",
  model: "gemini-3-flash-preview",
  models: ["gemini-3-flash-preview", "gemini-2.5-flash", "gpt-4o-mini"],
  batch_size: 12,
  api_key_configured: true,
  mode: "mock",
};

const requirements: Requirement[] = Array.from({ length: 31 }, (_, index) => ({
  report_id: `R-${String(index + 1).padStart(2, "0")}`,
  source_id: index % 4 === 0 ? `REQ-${index + 1}` : "—",
  section: index < 18 ? "Функциональные требования" : "Интеграция и API",
  line_number: 18 + index * 3,
  short_text: `Обработать условие и получить проверяемый результат ${index + 1}`,
  quote: `Система должна обработать событие в установленный срок ${index + 1}.`,
  quote_verified: true,
  verdicts: {
    complete: index % 3 ? "ok" : "violation",
    consistent: index % 5 ? "ok" : "violation",
    verifiable: index % 4 ? "ok" : "violation",
    feasible: "ok",
    traceable: index % 7 ? "ok" : "n.a.",
  },
  defect_keys: mockDefects
    .filter((defect) => defect.requirement_ids.includes(`R-${String(index + 1).padStart(2, "0")}`))
    .map((defect) => defect.key),
}));

export const mockTraceability: TraceabilityRow[] = [
  {
    goal: "Своевременно информировать пользователя",
    requirement_ids: ["R-01", "R-02"],
    acceptance_ids: ["R-12"],
    api_ids: ["R-21"],
    status: "covered",
  },
  {
    goal: "Снизить число обращений в поддержку",
    requirement_ids: ["R-03"],
    acceptance_ids: [],
    api_ids: [],
    status: "missing",
  },
  {
    goal: "Сохранить управляемость настройки",
    requirement_ids: ["R-05", "R-06"],
    acceptance_ids: ["R-14"],
    api_ids: ["R-24", "R-25"],
    status: "covered",
  },
];

export const mockTestCases: TestCase[] = Array.from({ length: 8 }, (_, index) => ({
  id: `TC-CARD-${String(index + 1).padStart(3, "0")}`,
  requirement_ids: [`R-${String(index + 1).padStart(2, "0")}`],
  preconditions: ["Пользователь авторизован", "Тестовые данные подготовлены"],
  steps: ["Отправить корректный запрос", "Дождаться обработки", "Проверить результат"],
  expected_result: "Результат соответствует правилу и записан в журнал аудита.",
  boundary_values: ["Нижняя граница", "Верхняя граница"],
}));

const reportFinding = {
  criterion: "verifiable",
  severity: "critical" as const,
  quote: requirements[0].quote,
  requirement_ids: ["R-01"],
  location: requirements[0].section + ", строка 18",
  explanation: "Не определены начало, конец и статистический показатель времени обработки.",
  fix: "Указать измеряемый интервал и допустимый процентиль.",
  quote_verified: true,
  defect_key: "CARD-1",
};

export const mockReport: Report = {
  metadata: {
    title: "Требования к сервису уведомлений",
    provider: "gemini",
    model: "gemini-3-flash-preview",
    agent_version: "0.1.0+b806f4c",
    coverage_percent: 96,
    run_at: dates[2],
    duration_seconds: 139,
    llm_calls: 9,
    cache_hits: 4,
    input_sha256: "9c91…e54b",
  },
  requirements,
  requirement_checks: requirements.map((requirement, index) => ({
    requirement_id: requirement.report_id,
    verdicts: requirement.verdicts ?? {},
    findings: index < 12 && index % 2 === 0 ? [{ ...reportFinding, quote: requirement.quote }] : [],
    rewrite:
      index < 12 && index % 2 === 0
        ? `${requirement.short_text}; результат измеряется установленным способом.`
        : "",
  })),
  set_check: {
    verdicts: {
      complete: "violation",
      consistent: "violation",
      feasible: "ok",
      comprehensible: "ok",
      validatable: "violation",
    },
    findings: [
      {
        ...reportFinding,
        criterion: "consistent",
        requirement_ids: ["R-02", "R-12"],
        related_quotes: [requirements[11].quote],
        explanation: "Правило и пример приводят к разным результатам.",
        defect_key: "CARD-2",
      },
    ],
    missing_sections: ["План отката", "Методика нагрузочного тестирования"],
    traceability: "Две цели покрыты полностью, одна цель не имеет критерия приёмки.",
    traceability_matrix: mockTraceability,
  },
  summary: {
    requirement_count: 31,
    finding_count: 18,
    by_severity: { critical: 4, major: 10, minor: 4 },
    by_criterion: { complete: 6, consistent: 5, verifiable: 4, traceable: 3 },
    critical_groups: {
      unverifiable: [reportFinding],
      contradictory: [{ ...reportFinding, explanation: "Правило противоречит примеру." }],
      incomplete: [{ ...reportFinding, explanation: "Не описан обязательный отрицательный путь." }],
      other: [],
    },
    decision: "С оговорками",
    justification: "Обнаружено 18 нарушений, включая 4 критических; покрытие составляет 96%.",
    top_fixes: [
      { fix: "Согласовать правила с примерами и критериями приёмки." },
      { fix: "Добавить измеримые границы времени и методику измерения." },
      { fix: "Описать отрицательные пути и граничные значения." },
    ],
  },
  context: {
    traceability_matrix: mockTraceability,
    findings: [
      {
        requirement_quote: requirements[20].quote,
        context_quote: "Изменяющие состояние операции выполняются идемпотентным методом.",
        context_file: "policies.md, строка 14",
        explanation: "Способ интеграции не соответствует политике проекта.",
      },
    ],
  },
  test_cases: mockTestCases,
  diff: {},
};

const comments: Comment[] = [
  {
    id: "comment-1",
    defect_key: "CARD-1",
    author: "Мария Ким",
    text: "Добавила сценарий проверки в план тестирования.",
    created_at: dates[2],
  },
];

const history: DefectHistory[] = [
  {
    id: "history-1",
    defect_key: "CARD-1",
    at: dates[0],
    actor: "Агент",
    action: "Создан",
    details: "Найден в прогоне #1",
  },
  {
    id: "history-2",
    defect_key: "CARD-1",
    at: dates[2],
    actor: "Агент",
    action: "Найден снова",
    details: "Найден в прогоне #3",
  },
];

const filters: SavedFilter[] = [
  {
    id: "filter-1",
    project_key: "CARD",
    name: "Критические открытые",
    query: { severity: "critical", status: "open" },
  },
];

function filteredDefects(path: string): Defect[] {
  const query = new URLSearchParams(path.split("?")[1] ?? "");
  return mockDefects.filter((defect) => {
    const fields = ["status", "severity", "criterion", "type", "assignee"] as const;
    if (fields.some((field) => query.get(field) && defect[field] !== query.get(field))) return false;
    const text = query.get("q")?.toLocaleLowerCase("ru");
    return !text || `${defect.key} ${defect.title}`.toLocaleLowerCase("ru").includes(text);
  });
}

function search(path: string): SearchResults {
  const query = new URLSearchParams(path.split("?")[1]).get("q")?.toLocaleLowerCase("ru") ?? "";
  return {
    projects: mockProjects
      .filter((item) => `${item.key} ${item.name}`.toLocaleLowerCase("ru").includes(query))
      .map(({ key, name }) => ({ key, name })),
    defects: mockDefects
      .filter((item) => `${item.key} ${item.title}`.toLocaleLowerCase("ru").includes(query))
      .slice(0, 6)
      .map(({ key, title, project_key }) => ({ key, title, project_key })),
    requirements: requirements
      .filter((item) => `${item.report_id} ${item.short_text}`.toLocaleLowerCase("ru").includes(query))
      .slice(0, 6)
      .map((item) => ({ ...item, project_key: "CARD" })),
  };
}

export function mockResponse<T>(path: string, init: RequestInit = {}): T {
  const method = init.method ?? "GET";
  if (path === "/config") return mockConfig as T;
  if (path.startsWith("/search?")) return search(path) as T;
  if (path === "/projects") return mockProjects as T;
  if (/^\/projects\/[^/]+$/.test(path)) {
    return (mockProjects.find((project) => path.endsWith(project.key)) ?? mockProjects[0]) as T;
  }
  if (path.endsWith("/dashboard")) return mockDashboard as T;
  if (path.endsWith("/documents")) return mockDocuments as T;
  if (path.endsWith("/runs")) return mockRuns as T;
  if (path.startsWith("/runs/compare")) {
    return {
      fixed: mockDefects.slice(20, 24),
      new: mockDefects.slice(0, 3),
      remaining: mockDefects.slice(5, 10),
    } as T;
  }
  if (/^\/runs\/[^/]+$/.test(path)) {
    return (mockRuns.find((run) => path.endsWith(run.id)) ?? mockRuns[2]) as T;
  }
  if (path.endsWith("/report")) return mockReport as T;
  if (path.includes("/defects?")) {
    const items = filteredDefects(path);
    return { items, total: items.length, page: 1, page_size: 50 } as T;
  }
  if (/^\/defects\/[^/]+$/.test(path)) {
    const key = path.split("/").pop();
    return (mockDefects.find((defect) => defect.key === key) ?? mockDefects[0]) as T;
  }
  if (path.endsWith("/comments")) return comments as T;
  if (path.endsWith("/history")) return history as T;
  if (path.endsWith("/members")) return mockMembers as T;
  if (path.endsWith("/filters")) return filters as T;
  if (path.endsWith("/requirements")) return requirements as T;
  if (path.endsWith("/traceability")) return mockTraceability as T;
  if (path.endsWith("/testcases")) return mockTestCases as T;
  if (path.endsWith("/context")) return mockContext as T;
  if (path.endsWith("/context/extracted")) {
    return {
      goals: ["Своевременное информирование", "Снижение обращений"],
      scope_in: ["Обработка событий", "Управление настройкой"],
      scope_out: ["Замена процессинга"],
      constraints: ["Использовать существующий сервис уведомлений"],
    } as T;
  }
  if (path.includes("/context/") && path.endsWith("/preview")) {
    return { text: "# Контекст проекта\n\nЦели, ограничения и правила интеграции." } as T;
  }
  if (method !== "GET") return {} as T;
  return {} as T;
}
