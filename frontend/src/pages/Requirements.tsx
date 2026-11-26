import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Requirement } from "../api/types";
import { PageTitle } from "../components/Layout";
import { Card, Checkbox, EmptyState, Input, Skeleton, Table, cx } from "../components/ui";
import { VerdictDots } from "../features/requirements/VerdictDots";

export function RequirementsPage() {
  const { key } = useParams();
  const [items, setItems] = useState<Requirement[]>();
  const [query, setQuery] = useState("");
  const [onlyViolations, setOnlyViolations] = useState(false);
  const { hash } = useLocation();
  const target = decodeURIComponent(hash.slice(1));

  useEffect(() => {
    api<Requirement[]>(`/projects/${key}/requirements`).then(setItems);
  }, [key]);

  // Переход по ссылке R-xx (из дефекта, отчёта или поиска): прокручиваем к строке и подсвечиваем её.
  useEffect(() => {
    if (!items || !target) return;
    document.getElementById(target)?.scrollIntoView({ block: "center" });
  }, [items, target]);

  const filtered = items?.filter((item) => {
    const matches = JSON.stringify(item).toLowerCase().includes(query.toLowerCase());
    const violates = Object.values(item.verdicts ?? {}).includes("violation");
    return matches && (!onlyViolations || violates);
  });

  return (
    <>
      <PageTitle title="Требования" subtitle="Реестр последнего прогона" />
      <Card>
        <div className="mb-4 flex flex-wrap gap-4">
          <Input
            className="max-w-md"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по ID, разделу или тексту…"
          />
          <label className="flex items-center gap-2">
            <Checkbox
              checked={onlyViolations}
              onChange={(event) => setOnlyViolations(event.target.checked)}
            />
            Только с нарушениями
          </label>
        </div>
        {!items ? (
          <Skeleton className="h-64" />
        ) : filtered?.length ? (
          <Table>
            <thead className="bg-[var(--muted)]">
              <tr>
                {["ID", "РАЗДЕЛ", "ФОРМУЛИРОВКА", "ВЕРДИКТЫ", "ДЕФЕКТЫ"].map((label) => (
                  <th className="p-3" key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  id={item.report_id}
                  className={cx("border-t scroll-mt-24", item.report_id === target && "bg-[var(--accent)]")}
                  key={item.report_id}
                >
                  <td className="mono whitespace-nowrap p-3 font-bold text-[var(--primary)]">{item.report_id}</td>
                  <td className="p-3">{item.section}</td>
                  <td className="p-3">{item.short_text}</td>
                  <td className="p-3"><VerdictDots verdicts={item.verdicts ?? {}} /></td>
                  <td className="p-3">
                    <Link
                      className="text-[var(--primary)]"
                      to={`/projects/${key}/defects?q=${item.report_id}`}
                    >
                      {item.defect_keys?.length ?? 0} →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Требования не найдены" description="Измените условия поиска." />
        )}
      </Card>
    </>
  );
}
