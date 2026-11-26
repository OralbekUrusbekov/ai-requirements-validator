import { criterionLabel } from "../../lib/labels";
import { Copy } from "lucide-react";
import { Link } from "react-router-dom";
import type { Report } from "../../api/types";
import { Button, Card, Tooltip, useToast } from "../../components/ui";
import { FindingCard } from "./FindingCard";

function VerdictChip({ criterion, verdict }: { criterion: string; verdict: string }) {
  const view =
    verdict === "ok"
      ? { symbol: "✓", label: "OK", className: "bg-green-100 text-green-800" }
      : verdict === "violation"
        ? { symbol: "✕", label: "Нарушение", className: "bg-red-100 text-red-800" }
        : { symbol: "○", label: "Н/П", className: "bg-gray-100 text-gray-700" };
  return (
    <Tooltip text={`${criterionLabel(criterion)}: ${view.label}`}>
      <span className={`rounded px-2 py-1 text-xs ${view.className}`}>
        {view.symbol} {criterionLabel(criterion)}
      </span>
    </Tooltip>
  );
}

export function RequirementReview({ report, projectKey }: { report: Report; projectKey?: string }) {
  const toast = useToast();
  const checks = new Map(report.requirement_checks.map((check) => [check.requirement_id, check]));
  return (
    <div className="grid gap-4">
      {report.requirements.map((requirement) => {
        const check = checks.get(requirement.report_id);
        return (
          <Card id={requirement.report_id} key={requirement.report_id}>
            <div className="flex flex-wrap justify-between gap-3">
              <h3 className="font-bold">
                <span className="mono text-[var(--primary)]">{requirement.report_id}</span>
                {" · "}{requirement.section}
              </h3>
              <div className="flex gap-2">
                {check?.findings.map((finding) => finding.defect_key && (
                  <Link
                    key={finding.defect_key}
                    className="mono text-[var(--primary)] hover:underline"
                    to={`/projects/${projectKey}/defects?d=${finding.defect_key}`}
                  >
                    {finding.defect_key}
                  </Link>
                ))}
              </div>
            </div>
            <blockquote className="my-3 border-l-2 border-[var(--border)] pl-3">
              «{requirement.quote}»
            </blockquote>
            <div className="flex flex-wrap gap-1">
              {Object.entries(check?.verdicts ?? {}).map(([criterion, verdict]) => (
                <VerdictChip key={criterion} criterion={criterion} verdict={verdict} />
              ))}
            </div>
            {check?.rewrite && (
              <div className="mt-3 rounded bg-green-50 p-4 text-green-900 dark:bg-green-950/30 dark:text-green-100">
                <b>Предлагаемая переформулировка</b>
                <p className="mt-1">{check.rewrite}</p>
                <Button
                  className="mt-2 bg-transparent text-current"
                  onClick={() =>
                    navigator.clipboard.writeText(check.rewrite).then(() => toast.push("Скопировано"))
                  }
                >
                  <Copy size={16} />Копировать
                </Button>
              </div>
            )}
            {check?.findings.map((finding, index) => (
              <FindingCard key={index} finding={finding} projectKey={projectKey} />
            ))}
          </Card>
        );
      })}
    </div>
  );
}
