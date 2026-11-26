import { criterionLabel } from "../../lib/labels";
import { Link } from "react-router-dom";
import type { Finding } from "../../api/types";
import { Badge } from "../../components/ui";

function severityClass(severity: string): string {
  if (severity === "critical") return "bg-red-100 text-red-800";
  if (severity === "major") return "bg-amber-100 text-amber-900";
  return "bg-gray-100 text-gray-700";
}

export function FindingCard({ finding, projectKey }: { finding: Finding; projectKey?: string }) {
  return (
    <article className="mt-3 rounded border-l-4 border-[var(--destructive)] bg-[var(--muted)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={severityClass(finding.severity)}>{finding.severity.toUpperCase()}</Badge>
        <b>{criterionLabel(finding.criterion)}</b>
        {finding.confidence && <Badge className="bg-[var(--secondary)]">уверенность: {finding.confidence}</Badge>}
        {finding.defect_key && projectKey && (
          <Link
            className="mono text-[var(--primary)] hover:underline"
            to={`/projects/${projectKey}/defects?d=${finding.defect_key}`}
          >
            {finding.defect_key}
          </Link>
        )}
      </div>
      <blockquote className="my-3 border-l-2 border-[var(--gold)] pl-3">
        «{finding.quote}»
        <small className="block text-[var(--muted-foreground)]">📍 {finding.location}</small>
        {!finding.quote_verified && <small className="block text-red-700">Цитата не подтверждена</small>}
      </blockquote>
      <p>{finding.explanation}</p>
      <p className="mt-2 rounded bg-green-50 p-3 text-green-900 dark:bg-green-950/30 dark:text-green-100">
        <b>Исправление:</b> {finding.fix}
      </p>
    </article>
  );
}
