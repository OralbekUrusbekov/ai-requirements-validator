import { criterionLabel, defectTypeLabel } from "../../lib/labels";
import type { Defect, DefectStatus } from "../../api/types";
import { Badge, Card, Checkbox } from "../../components/ui";
import { severityClass, statusLabels, statuses } from "./constants";

interface DefectBoardProps {
  items: Defect[];
  selected: string[];
  onSelect: (key: string, checked: boolean) => void;
  onOpen: (key: string) => void;
  onMove: (key: string, status: DefectStatus) => void;
}

export function DefectBoard(props: DefectBoardProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {statuses.map((status) => {
        const defects = props.items.filter((item) => item.status === status);
        return (
          <section
            className="min-h-72 rounded-lg bg-[var(--muted)] p-3"
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const key = event.dataTransfer.getData("text/defect");
              if (key) props.onMove(key, status);
            }}
          >
            <h2 className="mb-3 flex justify-between font-bold"><span>{statusLabels[status]}</span><span>{defects.length}</span></h2>
            <div className="grid gap-3">
              {defects.map((defect) => (
                <Card draggable onDragStart={(event) => event.dataTransfer.setData("text/defect", defect.key)} className="cursor-grab p-3" key={defect.key}>
                  <div className="flex items-center justify-between">
                    <Checkbox checked={props.selected.includes(defect.key)} onChange={(event) => props.onSelect(defect.key, event.target.checked)} aria-label={`Выбрать ${defect.key}`} />
                    <Badge className={severityClass(defect.severity)}>{defect.severity.toUpperCase()}</Badge>
                  </div>
                  <button type="button" className="mt-2 w-full text-left" onClick={() => props.onOpen(defect.key)}>
                    <b className="mono text-[var(--primary)]">{defect.key}</b>
                    <p className="mt-1 font-medium">{defect.title}</p>
                    <small>{criterionLabel(defect.criterion)} · {defect.assignee || "Не назначен"}</small>
                  </button>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
