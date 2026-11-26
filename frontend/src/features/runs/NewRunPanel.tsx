import { Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ApiConfig, Document } from "../../api/types";
import { Button, Card, Checkbox, Select } from "../../components/ui";

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

const UPLOAD_NEW = "__upload__";

export function NewRunPanel(props: NewRunPanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File>();
  const [uploading, setUploading] = useState(false);
  const [documentId, setDocumentId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [values, setValues] = useState<Omit<NewRunValues, "document_version_id">>({
    provider: props.config?.provider ?? "",
    model: props.config?.model ?? "",
    use_context: true,
    tests: false,
    domain_check: true,
  });

  // По умолчанию — первый документ проекта. Пока документов нет (ещё грузятся или проект пустой),
  // documentId остаётся пустым, а панель показывает загрузку файла.
  useEffect(() => {
    if (documentId === UPLOAD_NEW || props.documents.some((item) => item.id === documentId)) return;
    setDocumentId(props.documents[0]?.id ?? "");
  }, [props.documents, documentId]);

  const document = props.documents.find((item) => item.id === documentId);
  const versions = useMemo(
    () => [...(document?.versions ?? [])].sort((a, b) => b.version - a.version),
    [document],
  );

  // При смене документа (или появлении новой версии) выбираем последнюю версию.
  useEffect(() => {
    if (!versions.some((item) => item.id === versionId)) setVersionId(versions[0]?.id ?? "");
  }, [versions, versionId]);

  async function upload(file: File) {
    setSelectedFile(file);
    setUploading(true);
    try {
      // Файл с тем же именем, что у существующего документа, становится его новой версией.
      const existing = props.documents.find((item) => item.name === file.name);
      await props.onUpload(file, existing?.id);
      if (existing) setDocumentId(existing.id);
    } finally {
      setUploading(false);
    }
  }

  // Новый документ после загрузки выбираем автоматически.
  useEffect(() => {
    if ((documentId && documentId !== UPLOAD_NEW) || !selectedFile || uploading) return;
    const created = props.documents.find((item) => item.name === selectedFile.name);
    if (created) setDocumentId(created.id);
  }, [props.documents, documentId, selectedFile, uploading]);

  const showUpload = documentId === UPLOAD_NEW || !props.documents.length;

  return (
    <Card className="mb-5">
      <h2 className="mb-4 text-xl font-bold">Новая проверка</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <label>
          <span className="label">Документ</span>
          <Select value={documentId || UPLOAD_NEW} onChange={(event) => setDocumentId(event.target.value)}>
            {props.documents.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
            <option value={UPLOAD_NEW}>Загрузить новый…</option>
          </Select>
        </label>
        <label>
          <span className="label">Версия</span>
          <Select
            value={versionId}
            disabled={!versions.length}
            onChange={(event) => setVersionId(event.target.value)}
          >
            {!versions.length && <option value="">—</option>}
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                v{version.version} · {version.uploaded_at.slice(0, 10)}
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
      </div>
      {showUpload && (
        <label
          className={[
            "mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg",
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
          <b>{selectedFile?.name ?? "Перетащите файл или нажмите, чтобы выбрать"}</b>
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
              event.target.value = "";
            }}
          />
        </label>
      )}
      <div className="my-4 flex flex-wrap gap-5">
        {([
          ["use_context", "Учитывать контекст проекта"],
          ["tests", "Генерировать тест-кейсы"],
          ["domain_check", "Доменная проверка"],
        ] as const).map(([name, label]) => (
          <label className="flex items-center gap-2" key={name}>
            <Checkbox
              checked={values[name]}
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
          disabled={!versionId || uploading}
          onClick={() => props.onStart({ ...values, document_version_id: versionId })}
        >
          Запустить
        </Button>
      </div>
    </Card>
  );
}
