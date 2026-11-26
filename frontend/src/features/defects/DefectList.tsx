import { ArrowDown, ArrowUp } from "lucide-react";
import { criterionLabel } from "../../lib/labels";
import type { Defect } from "../../api/types";
import { Badge, Checkbox, Table } from "../../components/ui";
import { severityClass, statusLabels } from "./constants";

interface DefectListProps {
  items: Defect[];
  selected: string[];
  sort: string;
  onSort: (sort: string) => void;
  onSelect: (key: string, checked: boolean) => void;
  onOpen: (key: string) => void;
}

/** Колонки списка; sort — поле сортировки на бэкенде (если колонка сортируемая). */
const columns: Array<{ label: string; sort?: string }> = [
  { label: "" }, { label: "КЛЮЧ", sort: "number" }, { label: "ЗАГОЛОВОК" },
  { label: "СЕРЬЁЗНОСТЬ", sort: "severity" }, { label: "КРИТЕРИЙ" }, { label: "СТАТУС", sort: "status" },
  { label: "ТРЕБОВАНИЕ" }, { label: "РАЗДЕЛ" }, { label: "ПРОГОН" }, { label: "ИСПОЛНИТЕЛЬ" },
];

export function DefectList({ items, selected, sort, onSort, onSelect, onOpen }: DefectListProps) {
  const [sortColumn, sortDirection] = sort.split(":");
  return (
    <Table>
      <thead className="bg-[var(--muted)]">
        <tr>
          {columns.map((column) => {
            if (!column.sort) return <th className="p-3" key={column.label}>{column.label}</th>;
            const active = sortColumn === column.sort;
            const next = `${column.sort}:${active && sortDirection === "asc" ? "desc" : "asc"}`;
            return (
              <th
                className="p-3"
                key={column.label}
                aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              >
                <button type="button" className="inline-flex items-center gap-1 font-[inherit]" onClick={() => onSort(next)}>
                  {column.label}
                  {active && (sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>{items.map((defect) => (
        <tr className="border-t" key={defect.key}>
          <td className="p-3"><Checkbox checked={selected.includes(defect.key)} onChange={(event) => onSelect(defect.key, event.target.checked)} aria-label={`Выбрать ${defect.key}`} /></td>
          <td className="p-3"><button className="mono font-bold text-[var(--primary)]" onClick={() => onOpen(defect.key)}>{defect.key}</button></td>
          <td className="p-3">{defect.title}</td><td className="p-3"><Badge className={severityClass(defect.severity)}>{defect.severity.toUpperCase()}</Badge></td>
          <td className="p-3">{criterionLabel(defect.criterion)}</td><td className="p-3">{statusLabels[defect.status]}</td>
          <td className="mono p-3">{defect.requirement_ids.join(", ")}</td><td className="p-3">{defect.location.split(", строка")[0]}</td>
          <td className="mono p-3">{defect.first_run_number ? `#${defect.first_run_number}` : "—"}</td>
          <td className="p-3">{defect.assignee || "Не назначен"}</td>
        </tr>
      ))}</tbody>
    </Table>
  );
}
