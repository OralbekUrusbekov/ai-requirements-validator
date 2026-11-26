import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { apiUrl } from "../api/client";
import { useReport, useRun } from "../api/hooks";
import type { Finding, TraceabilityRow } from "../api/types";
import { PageTitle } from "../components/Layout";
import { Badge, Button, Card, ErrorState, Input, Skeleton, Table, Tabs } from "../components/ui";
import { FindingCard } from "../features/report/FindingCard";
import { RequirementReview } from "../features/report/RequirementReview";
import { TestCaseGrid } from "../features/report/TestCaseGrid";
import { TraceabilityView } from "../features/report/TraceabilityView";

const tabs = [
  "Паспорт",
  "Нарезка требований",
  "Проверка требований",
  "Проверка набора",
  "Сводка",
  "Итог",
  "Контекст и трассируемость",
  "Тест-кейсы",
].map((label, index) => ({ id: String(index + 1), label: `${index + 1}. ${label}` }));

function Passport({ metadata, summary }: { metadata: Record<string, any>; summary: Record<string, any> }) {
  const rows = [
    ["Документ", metadata.title],
    ["Стандарт", "ISO/IEC/IEEE 29148 · IEEE 830"],
    ["Модель", `${metadata.provider} / ${metadata.model}`],
    ["Версия агента", metadata.agent_version],
    ["Требований", summary.requirement_count],
    ["Покрытие", `${metadata.coverage_percent}%`],
    ["Дата", metadata.run_at],
    ["Длительность", `${metadata.duration_seconds} с`],
    ["Вызовов LLM", metadata.llm_calls],
    ["Хэш файла", metadata.input_sha256],
  ];
  return (
    <Card>
      <dl className="grid sm:grid-cols-2">
        {rows.map(([key, value]) => (
          <div className="grid grid-cols-2 border-b p-3" key={key}>
            <dt className="text-[var(--muted-foreground)]">{key}</dt>
            <dd className="break-all font-medium">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Summary({ summary }: { summary: Record<string, any> }) {
  const counters = [
    ["Требований", summary.requirement_count],
    ["Нарушений", summary.finding_count],
    ["Critical", summary.by_severity?.critical ?? 0],
    ["Major", summary.by_severity?.major ?? 0],
  ];
  const groupLabels: Record<string, string> = {
    unverifiable: "Непроверяемые",
    contradictory: "Противоречивые",
    incomplete: "Неполные",
  };
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        {counters.map(([label, value]) => (
          <Card key={label}><small>{label}</small><b className="block text-3xl">{value}</b></Card>
        ))}
      </div>
      <Card className="mt-4">
        <h3 className="font-bold">По критериям</h3>
        <div className="mt-3 grid gap-2">
          {Object.entries(summary.by_criterion ?? {}).map(([criterion, count]) => (
            <div className="flex items-center gap-3" key={criterion}>
              <span className="w-36">{criterion}</span>
              <div className="h-3 flex-1 rounded bg-[var(--muted)]">
                <div className="h-full rounded bg-[var(--gold)]" style={{ width: `${Math.min(100, Number(count) * 10)}%` }} />
              </div>
              <b>{String(count)}</b>
            </div>
          ))}
        </div>
      </Card>
      {Object.keys(groupLabels).map((key) => [key, summary.critical_groups?.[key] ?? []] as const).map(([key, value]) => (
        <Card className="mt-4" key={key}>
          <h3 className="font-bold">{groupLabels[key] ?? key}</h3>
          {(value as Finding[]).length ? (
            <ul className="mt-2 list-disc space-y-2 pl-5">
              {(value as Finding[]).map((finding, index) => (
                <li key={index}>
                  <b className="mono">{finding.requirement_ids?.join(", ")}</b>
                  {" · "}{finding.explanation} · {finding.location}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[var(--muted-foreground)]">Не выявлены</p>}
        </Card>
      ))}
    </>
  );
}

export function ReportPage() {
  const { runId, key } = useParams();
  const run = useRun(runId);
  const report = useReport(runId, run.data?.status === "done");
  const [tab, setTab] = useState("1");
  const [search, setSearch] = useState("");

  if (run.error) return <ErrorState error={run.error} retry={() => run.refetch()} />;
  if (run.isLoading || run.data?.status !== "done" || report.isLoading) {
    return (
      <>
        <PageTitle title={`Отчёт · ${run.data ? `прогон #${run.data.number}` : "загрузка"}`} />
        {run.data?.status === "error" ? (
          <Card className="border-red-300 text-red-800">{run.data.error}</Card>
        ) : (
          <Card>
            <p>{run.data?.step || "Загрузка"} · {run.data?.progress || 0}%</p>
            <div className="mt-3 h-2 rounded bg-[var(--muted)]">
              <div className="h-full rounded bg-[var(--primary)]" style={{ width: `${run.data?.progress || 0}%` }} />
            </div>
          </Card>
        )}
      </>
    );
  }
  if (report.error) return <ErrorState error={report.error} retry={() => report.refetch()} />;
  if (!report.data) return <Skeleton className="h-96" />;

  const data = report.data;
  const matrix = (data.context?.traceability_matrix || data.set_check.traceability_matrix || []) as TraceabilityRow[];
  return (
    <>
      <PageTitle
        title={`Отчёт · прогон #${run.data.number}`}
        subtitle={`${run.data.document_name} v${run.data.document_version} · ${run.data.model}`}
        actions={
          <div className="flex flex-wrap gap-2 no-print">
            {["md", "html", "docx", "json"].map((extension) => (
              <a key={extension} href={apiUrl(`/runs/${runId}/report.${extension}`)}>
                <Button className="bg-transparent text-[var(--foreground)]">
                  <Download size={16} />{extension.toUpperCase()}
                </Button>
              </a>
            ))}
            <Button className="bg-transparent text-[var(--foreground)]" onClick={() => window.print()}>
              <Printer size={16} />Печать
            </Button>
          </div>
        }
      />
      <Tabs items={tabs} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === "1" && <Passport metadata={data.metadata} summary={data.summary} />}
        {tab === "2" && (
          <Card>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по требованиям…"
              className="mb-4"
            />
            <Table>
              <thead className="bg-[var(--muted)]">
                <tr>
                  {["ID в отчёте", "ID в документе", "Раздел", "Строка", "Формулировка", "Цитата"].map(
                    (label) => <th className="p-3" key={label}>{label}</th>,
                  )}
                </tr>
              </thead>
              <tbody>
                {data.requirements
                  .filter((item) =>
                    JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((item) => (
                  <tr className="border-t" key={item.report_id}>
                    <td className="mono p-3 text-[var(--primary)]">{item.report_id}</td>
                    <td className="p-3">{item.source_id}</td><td className="p-3">{item.section}</td>
                    <td className="p-3">{item.line_number}</td><td className="p-3">{item.short_text}</td>
                    <td className="p-3">«{item.quote}»</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
        {tab === "3" && <RequirementReview report={data} projectKey={key} />}
        {tab === "4" && (
          <Card>
            <h2 className="text-xl font-bold">Противоречия и дефекты набора</h2>
            {data.set_check.findings.map((finding, index) => (
              <FindingCard key={index} finding={finding} projectKey={key} />
            ))}
            <h3 className="mt-5 font-bold">Вердикты набора</h3>
            <div>
              {Object.entries(data.set_check.verdicts).map(([criterion, verdict]) => (
                <Badge className="m-1 bg-[var(--muted)]" key={criterion}>
                  {criterion}: {verdict}
                </Badge>
              ))}
            </div>
            <h3 className="mt-4 font-bold">Отсутствующие разделы</h3>
            <p>{data.set_check.missing_sections.join(", ") || "Не выявлены"}</p>
          </Card>
        )}
        {tab === "5" && <Summary summary={data.summary} />}
        {tab === "6" && (
          <Card>
            <Badge className="bg-amber-100 px-5 py-3 text-lg text-amber-900">{data.summary.decision}</Badge>
            <p className="my-4 text-lg">{data.summary.justification}</p>
            <h3 className="font-bold">Что исправить в первую очередь</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-6">
              {(data.summary.top_fixes || []).map((item: { fix: string }, index: number) => (
                <li key={index}>{item.fix}</li>
              ))}
            </ol>
          </Card>
        )}
        {tab === "7" && (
          <>
            <TraceabilityView rows={matrix} />
            {data.context?.findings?.map((finding: any, index: number) => (
              <Card className="mt-4" key={index}>
                <div className="grid gap-3 md:grid-cols-2">
                  <blockquote className="border-l-2 border-red-400 pl-3">
                    Документ: «{finding.requirement_quote}»
                  </blockquote>
                  <blockquote className="border-l-2 border-amber-400 pl-3">
                    Контекст: «{finding.context_quote}»
                    <small className="block">{finding.context_file}</small>
                  </blockquote>
                </div>
                <p className="mt-3">{finding.explanation}</p>
              </Card>
            ))}
          </>
        )}
        {tab === "8" && <TestCaseGrid items={data.test_cases || []} />}
      </div>
    </>
  );
}
