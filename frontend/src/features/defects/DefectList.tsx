import { criterionLabel, defectTypeLabel } from "../../lib/labels";
import type { Defect } from "../../api/types";
import { Badge, Checkbox, Table } from "../../components/ui";
import { severityClass, statusLabels } from "./constants";

export function DefectList({ items, selected, onSelect, onOpen }: { items: Defect[]; selected: string[]; onSelect: (key: string, checked: boolean) => void; onOpen: (key: string) => void }) {
  return (
    <Table>
      <thead className="bg-[var(--muted)]"><tr>{["", "КЛЮЧ", "ЗАГОЛОВОК", "СЕРЬЁЗНОСТЬ", "КРИТЕРИЙ", "СТАТУС", "ТРЕБОВАНИЕ", "РАЗДЕЛ", "ИСПОЛНИТЕЛЬ"].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead>
      <tbody>{items.map((defect) => (
        <tr className="border-t" key={defect.key}>
          <td className="p-3"><Checkbox checked={selected.includes(defect.key)} onChange={(event) => onSelect(defect.key, event.target.checked)} /></td>
          <td className="p-3"><button className="mono font-bold text-[var(--primary)]" onClick={() => onOpen(defect.key)}>{defect.key}</button></td>
          <td className="p-3">{defect.title}</td><td className="p-3"><Badge className={severityClass(defect.severity)}>{defect.severity.toUpperCase()}</Badge></td>
          <td className="p-3">{criterionLabel(defect.criterion)}</td><td className="p-3">{statusLabels[defect.status]}</td>
          <td className="mono p-3">{defect.requirement_ids.join(", ")}</td><td className="p-3">{defect.location.split(", строка")[0]}</td>
          <td className="p-3">{defect.assignee || "Не назначен"}</td>
        </tr>
      ))}</tbody>
    </Table>
  );
}
