import { contextKeyLabels, contextValueText } from "../lib/labels";
import { FileText, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { ContextFile } from "../api/types";
import { PageTitle } from "../components/Layout";
import { Button, Card, Input, Select, useToast } from "../components/ui";

const contextLabels: Record<string, string> = {
  passport: "Паспорт проекта",
  glossary: "Глоссарий",
  systems: "Каталог систем / SLA",
  policies: "Политики ИБ",
  other: "Прочее",
};

export function ContextPage() {
  const { key } = useParams();
  const toast = useToast();
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [selected, setSelected] = useState<ContextFile>();
  const [preview, setPreview] = useState("");
  const [extracted, setExtracted] = useState<Record<string, unknown>>({});
  const [type, setType] = useState("passport");

  async function load() {
    const [fileData, extractedData] = await Promise.all([
      api<ContextFile[]>(`/projects/${key}/context`),
      api<Record<string, unknown>>(`/projects/${key}/context/extracted`),
    ]);
    setFiles(fileData);
    setExtracted(extractedData);
  }

  useEffect(() => { void load(); }, [key]);

  async function upload(file: File) {
    const body = new FormData();
    body.append("file", file);
    body.append("type", type);
    await api(`/projects/${key}/context`, { method: "POST", body });
    await load();
    toast.push("Файл контекста загружен");
  }

  async function open(file: ContextFile) {
    setSelected(file);
    const result = await api<{ text: string }>(
      `/projects/${key}/context/${file.id}/preview`,
    );
    setPreview(result.text);
  }

  async function remove(file: ContextFile) {
    await api(`/projects/${key}/context/${file.id}`, { method: "DELETE" });
    if (selected?.id === file.id) {
      setSelected(undefined);
      setPreview("");
    }
    await load();
    toast.push("Файл удалён");
  }

  return (
    <>
      <PageTitle
        title="Контекст проекта"
        actions={
          <div className="flex gap-2">
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              {Object.entries(contextLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </Select>
            <label className="inline-flex cursor-pointer">
              <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 font-semibold text-[var(--primary-foreground)]">
                <Upload size={17} />Загрузить
              </span>
              <input
                className="sr-only"
                type="file"
                accept=".pdf,.docx,.md,.txt"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </label>
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card>
          <h2 className="mb-3 font-bold">Файлы проекта</h2>
          <div className="grid gap-2">
            {files.map((file) => (
              <div
                className={`rounded border p-3 ${selected?.id === file.id ? "border-[var(--primary)]" : ""}`}
                key={file.id}
              >
                <button className="flex w-full gap-2 text-left" onClick={() => open(file)}>
                  <FileText className="shrink-0" />
                  <span>
                    <b>{file.filename}</b>
                    <small className="block">
                      {contextLabels[file.type] ?? file.type} · v{file.version} · {new Date(file.uploaded_at).toLocaleDateString("ru")}
                    </small>
                  </span>
                </button>
                <Button
                  className="mt-2 bg-transparent p-1 text-red-700"
                  onClick={() => remove(file)}
                >
                  <Trash2 size={16} />Удалить
                </Button>
              </div>
            ))}
          </div>
        </Card>
        <div className="grid gap-5">
          <Card>
            <h2 className="font-bold">Предпросмотр: {selected?.filename ?? "выберите файл"}</h2>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-[var(--muted)] p-4 text-sm">
              {preview || "Выберите файл слева, чтобы увидеть содержимое."}
            </pre>
          </Card>
          <Card>
            <h2 className="font-bold">Извлечено из паспорта</h2>
            {Object.keys(extracted).length ? (
              <dl className="mt-3 grid gap-3">
                {Object.entries(extracted)
                  .filter(([, values]) => contextValueText(values))
                  .map(([name, values]) => (
                    <div key={name} className="grid gap-1 sm:grid-cols-[140px_1fr]">
                      <dt className="font-semibold text-[var(--primary)]">
                        {contextKeyLabels[name] ?? name}
                      </dt>
                      <dd className="min-w-0 break-words">
                        {Array.isArray(values) ? (
                          <ul className="list-disc space-y-1 pl-4">
                            {values.map((value, index) => (
                              <li key={index}>{contextValueText(value)}</li>
                            ))}
                          </ul>
                        ) : (
                          contextValueText(values)
                        )}
                      </dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className="mt-2 text-[var(--muted-foreground)]">
                Последний прогон не использовал контекст.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
