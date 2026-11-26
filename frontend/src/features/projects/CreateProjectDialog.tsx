import { useEffect, useState } from "react";
import { api, jsonBody } from "../../api/client";
import { Button, Dialog, Input, Textarea, useToast } from "../../components/ui";

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function suggestedKey(name: string): string {
  const latin = name.toUpperCase().replace(/[^A-Z]/g, "");
  return (latin || "PROJ").slice(0, 10);
}

export function CreateProjectDialog({ open, onClose, onCreated }: CreateProjectDialogProps) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);

  useEffect(() => {
    if (!keyEdited) setKey(suggestedKey(name));
  }, [name, keyEdited]);

  async function submit() {
    if (!name.trim() || !/^[A-Z]{2,10}$/.test(key)) {
      toast.push("Укажите название и ключ из 2–10 латинских букв", "error");
      return;
    }
    try {
      await api("/projects", {
        method: "POST",
        body: jsonBody({ key, name, description, owner }),
      });
      toast.push("Проект создан");
      onCreated();
      onClose();
    } catch (error) {
      toast.push((error as Error).message, "error");
    }
  }

  return (
    <Dialog open={open} title="Создать проект" onClose={onClose}>
      <div className="grid gap-4">
        <label>
          <span className="label">Название</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </label>
        <label>
          <span className="label">Ключ</span>
          <Input
            value={key}
            maxLength={10}
            className="mono uppercase"
            onChange={(event) => {
              setKeyEdited(true);
              setKey(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""));
            }}
          />
          <small className="text-[var(--muted-foreground)]">2–10 латинских заглавных букв</small>
        </label>
        <label>
          <span className="label">Описание</span>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>
          <span className="label">Владелец</span>
          <Input value={owner} onChange={(event) => setOwner(event.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <Button className="bg-transparent text-[var(--foreground)]" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit}>Создать</Button>
        </div>
      </div>
    </Dialog>
  );
}
