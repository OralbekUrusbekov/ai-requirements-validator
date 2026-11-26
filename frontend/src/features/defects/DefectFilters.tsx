import { criterionLabel, filterCriteria } from "../../lib/labels";
import { Save, X } from "lucide-react";
import type { Member, SavedFilter } from "../../api/types";
import { Button, Card, Input, Select } from "../../components/ui";

interface DefectFiltersProps {
  params: URLSearchParams;
  members: Member[];
  saved: SavedFilter[];
  onChange: (name: string, value: string) => void;
  onReset: () => void;
  onSave: () => void;
  onApplySaved: (filter: SavedFilter) => void;
}

export function DefectFilters(props: DefectFiltersProps) {
  return (
    <Card className="mb-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          value={props.params.get("q") ?? ""}
          onChange={(event) => props.onChange("q", event.target.value)}
          placeholder="Ключ или текст"
          aria-label="Поиск дефекта"
        />
        <Select
          value={props.params.get("severity") ?? ""}
          onChange={(event) => props.onChange("severity", event.target.value)}
          aria-label="Серьёзность"
        >
          <option value="">Серьёзность: все</option>
          <option value="critical">Critical</option><option value="major">Major</option>
          <option value="minor">Minor</option>
        </Select>
        <Select
          value={props.params.get("criterion") ?? ""}
          onChange={(event) => props.onChange("criterion", event.target.value)}
          aria-label="Критерий"
        >
          <option value="">Критерий: все</option>
          {filterCriteria.map((item) => (
            <option key={item} value={item}>
              {criterionLabel(item)}
            </option>
          ))}
        </Select>
        <Select value={props.params.get("type") ?? ""} onChange={(event) => props.onChange("type", event.target.value)}>
          <option value="">Тип: все</option><option value="internal">Внутренний</option>
          <option value="context">Конфликт с контекстом</option><option value="domain">Доменный риск</option>
        </Select>
        <Select value={props.params.get("status") ?? ""} onChange={(event) => props.onChange("status", event.target.value)}>
          <option value="">Статус: все</option><option value="open">Открыт</option>
          <option value="in_progress">В работе</option><option value="fixed">Исправлен</option>
          <option value="rejected">Отклонён</option>
        </Select>
        <Select value={props.params.get("assignee") ?? ""} onChange={(event) => props.onChange("assignee", event.target.value)}>
          <option value="">Исполнитель: все</option>
          {props.members.map((member) => <option key={member.name}>{member.name}</option>)}
        </Select>
        <Input value={props.params.get("section") ?? ""} onChange={(event) => props.onChange("section", event.target.value)} placeholder="Раздел" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button className="bg-transparent text-[var(--foreground)]" onClick={props.onReset}><X size={16} />Сбросить</Button>
        <Button className="bg-transparent text-[var(--foreground)]" onClick={props.onSave}><Save size={16} />Сохранить фильтр</Button>
        {props.saved.map((filter) => (
          <button key={filter.id} className="rounded-full bg-[var(--secondary)] px-3 py-1 text-sm" onClick={() => props.onApplySaved(filter)}>{filter.name}</button>
        ))}
      </div>
    </Card>
  );
}
