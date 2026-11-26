import type { DefectStatus, Severity } from "../../api/types";

export const statusLabels: Record<DefectStatus, string> = {
  open: "ОТКРЫТ",
  in_progress: "В РАБОТЕ",
  fixed: "ИСПРАВЛЕН",
  rejected: "ОТКЛОНЁН",
};

export const statuses = Object.keys(statusLabels) as DefectStatus[];

export function severityClass(severity: Severity): string {
  if (severity === "critical") return "bg-red-100 text-red-800";
  if (severity === "major") return "bg-amber-100 text-amber-900";
  return "bg-gray-100 text-gray-700";
}
