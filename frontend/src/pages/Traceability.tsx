import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { TraceabilityRow } from "../api/types";
import { PageTitle } from "../components/Layout";
import { Skeleton } from "../components/ui";
import { TraceabilityView } from "../features/report/TraceabilityView";

export function TraceabilityPage() {
  const { key } = useParams();
  const [rows, setRows] = useState<TraceabilityRow[]>();

  useEffect(() => {
    api<TraceabilityRow[]>(`/projects/${key}/traceability`).then(setRows);
  }, [key]);

  return (
    <>
      <PageTitle
        title="Трассируемость"
        subtitle="Цели × Требования × Критерии приёмки × API. Красным — непокрытое."
      />
      {rows ? <TraceabilityView rows={rows} /> : <Skeleton className="h-72" />}
    </>
  );
}
