import { criterionLabel } from "../../lib/labels";
import { Tooltip } from "../../components/ui";

export function VerdictDots({ verdicts }: { verdicts: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(verdicts).map(([criterion, verdict]) => {
        const color = verdict === "ok" ? "bg-green-500" : verdict === "violation" ? "bg-red-500" : "bg-gray-400";
        const label = verdict === "ok" ? "OK" : verdict === "violation" ? "Нарушение" : "Н/П";
        return <Tooltip key={criterion} text={`${criterionLabel(criterion)}: ${label}`}><span className={`h-3 w-3 rounded-full ${color}`} /></Tooltip>;
      })}
    </div>
  );
}
