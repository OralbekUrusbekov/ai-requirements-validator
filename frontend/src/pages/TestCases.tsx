import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { TestCase } from "../api/types";
import { PageTitle } from "../components/Layout";
import { Button, Skeleton } from "../components/ui";
import { TestCaseGrid } from "../features/report/TestCaseGrid";

export function TestCasesPage() {
  const { key } = useParams();
  const [items, setItems] = useState<TestCase[]>();

  useEffect(() => {
    api<TestCase[]>(`/projects/${key}/testcases`).then(setItems);
  }, [key]);

  return (
    <>
      <PageTitle
        title="Тест-кейсы"
        actions={
          <a href={`/api/projects/${key}/testcases?format=csv`}>
            <Button><Download size={17} />Экспорт CSV</Button>
          </a>
        }
      />
      {items ? <TestCaseGrid items={items} /> : <Skeleton className="h-72" />}
    </>
  );
}
