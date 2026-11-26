import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonBody } from "../api/client";
import { useConfig, useProject } from "../api/hooks";
import type { Member } from "../api/types";
import { PageTitle } from "../components/Layout";
import { Button, Card, Checkbox, Dialog, Input, Select, useToast } from "../components/ui";
import { MembersEditor } from "../features/settings/MembersEditor";
import { criterionLabel } from "../lib/labels";

const criterionLabels = [
  "necessary", "appropriate", "unambiguous", "complete", "singular", "feasible",
  "verifiable", "correct", "conforming", "consistent", "traceable",
];

export function SettingsPage() {
  const { key } = useParams();
  const navigate = useNavigate();
  const project = useProject(key);
  const config = useConfig();
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [settings, setSettings] = useState({
    default_model: "", batch_size: 12, max_critical: 0, criteria: criterionLabels,
  });

  useEffect(() => {
    if (!project.data) return;
    setSettings({
      default_model: project.data.settings.default_model ?? config.data?.model ?? "",
      batch_size: project.data.settings.batch_size ?? 12,
      max_critical: project.data.settings.max_critical ?? 0,
      criteria: project.data.settings.criteria?.length
        ? project.data.settings.criteria
        : criterionLabels,
    });
  }, [project.data, config.data]);

  useEffect(() => {
    api<Member[]>(`/projects/${key}/members`).then(setMembers);
  }, [key]);

  async function save() {
    await Promise.all([
      api(`/projects/${key}`, { method: "PATCH", body: jsonBody({ settings }) }),
      api(`/projects/${key}/members`, { method: "PUT", body: jsonBody(members) }),
    ]);
    toast.push("Настройки сохранены");
  }

  async function removeProject() {
    await api(`/projects/${key}`, { method: "DELETE" });
    navigate("/");
  }

  return (
    <>
      <PageTitle title="Настройки" />
      <div className="grid gap-5">
        <Card>
          <h2 className="mb-4 text-lg font-bold">Проверка требований</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              <span className="label">Модель по умолчанию</span>
              <Select
                value={settings.default_model}
                onChange={(event) => setSettings({ ...settings, default_model: event.target.value })}
              >
                {config.data?.models.map((model) => <option key={model}>{model}</option>)}
              </Select>
            </label>
            <label>
              <span className="label">Размер пакета требований</span>
              <Input type="number" min={1} value={settings.batch_size} onChange={(event) => setSettings({ ...settings, batch_size: Number(event.target.value) })} />
            </label>
            <label>
              <span className="label">Max critical для старта</span>
              <Input type="number" min={0} value={settings.max_critical} onChange={(event) => setSettings({ ...settings, max_critical: Number(event.target.value) })} />
            </label>
          </div>
          <p className="mt-4">
            API-ключ модели: <b>{config.data?.api_key_configured ? "Ключ настроен: да" : "Ключ настроен: нет"}</b>
          </p>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-bold">Включённые критерии</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {criterionLabels.map((criterion) => (
              <label className="flex items-center gap-2" key={criterion}>
                <Checkbox
                  checked={settings.criteria.includes(criterion)}
                  onChange={(event) => setSettings({
                    ...settings,
                    criteria: event.target.checked
                      ? [...settings.criteria, criterion]
                      : settings.criteria.filter((item) => item !== criterion),
                  })}
                />
                {criterionLabel(criterion)}
              </label>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-bold">Участники и роли</h2>
          <MembersEditor members={members} onChange={setMembers} />
        </Card>
        <div className="flex justify-between">
          <Button className="bg-[var(--destructive)]" onClick={() => setDeleteOpen(true)}>
            Удалить проект
          </Button>
          <Button onClick={save}>Сохранить</Button>
        </div>
      </div>
      <Dialog open={deleteOpen} title="Удалить проект?" onClose={() => setDeleteOpen(false)}>
        <p>Будут удалены документы, прогоны и дефекты проекта. Это действие необратимо.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button className="bg-transparent text-[var(--foreground)]" onClick={() => setDeleteOpen(false)}>Отмена</Button>
          <Button className="bg-[var(--destructive)]" onClick={removeProject}>Удалить</Button>
        </div>
      </Dialog>
    </>
  );
}
