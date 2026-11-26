import { Upload } from "lucide-react";
import { useMemo, useState } from "react";
import type { ApiConfig, Document } from "../../api/types";
import { Button, Card, Checkbox, Input, Select } from "../../components/ui";

export interface NewRunValues {
  document_version_id: string;
  provider: string;
  model: string;
  use_context: boolean;
  tests: boolean;
  domain_check: boolean;
}

interface NewRunPanelProps {
  documents: Document[];
  config?: ApiConfig;
  onUpload: (file: File, documentId?: string) => Promise<void>;
  onStart: (values: NewRunValues) => Promise<void>;
  onClose: () => void;
}

export function NewRunPanel(props: NewRunPanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File>();
  const [uploading, setUploading] = useState(false);
  const [values, setValues] = useState<NewRunValues>({
    document_version_id: "",
    provider: props.config?.provider ?? "",
    model: props.config?.model ?? "",
    use_context: true,
    tests: false,
    domain_check: true,
  });

  const versions = useMemo(
    () =>
      props.documents.flatMap((document) =>
        document.versions.map((version) => ({ ...version, document })),
      ),
    [props.documents],
  );

  async function upload(file: File) {
    setSelectedFile(file);
    setUploading(true);
    try {
      await props.onUpload(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="mb-5">
      <h2 className="mb-4 text-xl font-bold">Новая проверка</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <label>
          <span className="label">Документ и версия</span>
          <Select
            value={values.document_version_id}
            onChange={(event) =>
              setValues((current) => ({ ...current, document_version_id: event.target.value }))
            }
          >
            <option value="">Выберите документ…</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.document.name} · v{version.version} · {new Date(version.uploaded_at).toLocaleDateString("ru")}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="label">Модель</span>
          <Select
            value={values.model || props.config?.model}
            onChange={(event) => setValues((current) => ({ ...current, model: event.target.value }))}
          >
            {props.config?.models.map((model) => <option key={model}>{model}</option>)}
          </Select>
        </label>
        <label
          className={[
            "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg",
            "border-2 border-dashed p-4 text-center transition focus-within:ring-2",
            dragActive ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)]",
          ].join(" ")}
          onDragEnter={() => setDragActive(true)}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files[0];
            if (file) void upload(file);
          }}
        >
          <Upload />
          <b>{selectedFile?.name ?? "Загрузить новый документ"}</b>
          <span className="text-sm text-[var(--muted-foreground)]">
            {uploading ? "Загрузка…" : "PDF, DOCX, MD, TXT · до 10 МБ"}
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

      <div className="my-4 flex flex-wrap gap-5">
        {[
          ["use_context", "Учитывать контекст проекта"],
          ["tests", "Генерировать тест-кейсы"],
          ["domain_check", "Доменная проверка"],
        ].map(([name, label]) => (
          <label className="flex items-center gap-2" key={name}>
            <Checkbox
              checked={values[name as keyof NewRunValues] as boolean}
              onChange={(event) =>
                setValues((current) => ({ ...current, [name]: event.target.checked }))
              }
            />
            {label}
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button className="bg-transparent text-[var(--foreground)]" onClick={props.onClose}>
          Отмена
        </Button>
        <Button
          className="bg-[var(--gold)] text-[var(--gold-foreground)]"
          onClick={() => props.onStart(values)}
        >
          Запустить
        </Button>
      </div>
    </Card>
  );
}
