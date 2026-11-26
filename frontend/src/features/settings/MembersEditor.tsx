import { Plus, Trash2 } from "lucide-react";
import type { Member } from "../../api/types";
import { Button, Input, Select } from "../../components/ui";

interface MembersEditorProps {
  members: Member[];
  onChange: (members: Member[]) => void;
}

export function MembersEditor({ members, onChange }: MembersEditorProps) {
  function update(index: number, value: Partial<Member>) {
    onChange(
      members.map((member, itemIndex) =>
        itemIndex === index ? { ...member, ...value } : member,
      ),
    );
  }

  return (
    <div className="grid gap-3">
      {members.map((member, index) => (
        <div
          className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"
          key={`${index}-${member.name}`}
        >
          <Input
            value={member.name}
            onChange={(event) => update(index, { name: event.target.value })}
            aria-label="Имя участника"
          />
          <Select
            value={member.role}
            onChange={(event) => update(index, { role: event.target.value })}
          >
            <option>Аналитик</option>
            <option>Тестировщик</option>
            <option>Архитектор</option>
          </Select>
          <Button
            className="bg-transparent px-3 text-red-700"
            aria-label="Удалить участника"
            onClick={() => onChange(members.filter((_, itemIndex) => itemIndex !== index))}
          >
            <Trash2 size={18} />
          </Button>
        </div>
      ))}
      <Button
        className="justify-self-start bg-transparent text-[var(--foreground)]"
        onClick={() => onChange([...members, { name: "", role: "Аналитик" }])}
      >
        <Plus size={17} />Добавить участника
      </Button>
    </div>
  );
}
