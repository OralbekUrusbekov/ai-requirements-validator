import { criterionLabel, defectTypeLabel } from "../../lib/labels";
import { Send } from "lucide-react";
import { useState } from "react";
import type { Comment, Defect, DefectHistory, DefectStatus, Member } from "../../api/types";
import { Badge, Button, Dialog, Select, Sheet, Textarea } from "../../components/ui";
import { severityClass, statusLabels, statuses } from "./constants";

interface DefectSheetProps {
  defect?: Defect;
  members: Member[];
  comments: Comment[];
  history: DefectHistory[];
  onClose: () => void;
  onPatch: (value: Partial<Defect>) => Promise<void>;
  onComment: (text: string) => Promise<void>;
}

export function DefectSheet(props: DefectSheetProps) {
  const [comment, setComment] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const defect = props.defect;

  async function submitComment() {
    if (!comment.trim()) return;
    await props.onComment(comment);
    setComment("");
  }

  return (
    <>
      <Sheet open={Boolean(defect)} onClose={props.onClose} title={defect?.key ?? "Дефект"}>
        {defect && (
          <div className="grid gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={severityClass(defect.severity)}>{defect.severity.toUpperCase()}</Badge>
                <Badge className="bg-[var(--secondary)]">{statusLabels[defect.status]}</Badge>
              </div>
              <h2 className="mt-2 text-xl font-bold">{defect.title}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">Статус</span>
                <Select
                  value={defect.status}
                  onChange={(event) =>
                    props.onPatch({ status: event.target.value as DefectStatus })
                  }
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>{statusLabels[status]}</option>
                  ))}
                </Select>
              </label>
              <label>
                <span className="label">Исполнитель</span>
                <Select
                  value={defect.assignee ?? ""}
                  onChange={(event) => props.onPatch({ assignee: event.target.value })}
                >
                  <option value="">Не назначен</option>
                  {props.members.map((member) => (
                    <option key={member.name}>{member.name}</option>
                  ))}
                </Select>
              </label>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-[var(--muted-foreground)]">Критерий</dt><dd>{criterionLabel(defect.criterion)}</dd>
              <dt className="text-[var(--muted-foreground)]">Тип</dt><dd>{defectTypeLabel(defect.type)}</dd>
              <dt className="text-[var(--muted-foreground)]">Требования</dt>
              <dd className="mono text-[var(--primary)]">{defect.requirement_ids.join(", ")}</dd>
              <dt className="text-[var(--muted-foreground)]">Найден в</dt><dd>{defect.first_run_number ? `прогон #${defect.first_run_number}` : "—"}</dd>
            </dl>
            <section>
              <h3 className="font-bold">Цитаты</h3>
              {defect.quotes.map((quote, index) => (
                <blockquote
                  className="mt-2 rounded border-l-4 border-[var(--gold)] bg-amber-50 p-3 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"
                  key={index}
                >
                  «{quote}»<small className="mt-2 block">📍 {defect.location}</small>
                </blockquote>
              ))}
            </section>
            <section>
              <h3 className="font-bold">Объяснение</h3>
              <p className="mt-1">{defect.explanation}</p>
            </section>
            <section className="rounded bg-green-50 p-4 text-green-900 dark:bg-green-950/30 dark:text-green-100">
              <h3 className="font-bold">Исправление</h3>
              <p className="mt-1">{defect.fix}</p>
            </section>
            <Button
              className="border-red-400 bg-transparent text-red-700"
              onClick={() => setRejectOpen(true)}
            >
              Отклонить как ложное срабатывание
            </Button>
            <section>
              <h3 className="font-bold">Комментарии ({props.comments.length})</h3>
              <div className="mt-2 grid gap-2">
                {props.comments.map((item) => (
                  <article className="rounded bg-[var(--muted)] p-3" key={item.id}>
                    <b>{item.author}</b><p>{item.text}</p>
                    <small>{new Date(item.created_at).toLocaleString("ru")}</small>
                  </article>
                ))}
              </div>
              <Textarea
                className="mt-3"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Добавить комментарий…"
              />
              <Button className="mt-2" onClick={submitComment}>
                <Send size={16} />Отправить
              </Button>
            </section>
            <section>
              <h3 className="font-bold">История</h3>
              <ol className="mt-2 border-l pl-4">
                {props.history.map((item) => (
                  <li className="mb-3" key={item.id}>
                    <b>{item.actor} · {item.action}</b><p>{item.details}</p>
                    <small>{new Date(item.at).toLocaleString("ru")}</small>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </Sheet>
      <Dialog open={rejectOpen} title="Причина отклонения" onClose={() => setRejectOpen(false)}>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Опишите, почему это ложное срабатывание"
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button
            className="bg-transparent text-[var(--foreground)]"
            onClick={() => setRejectOpen(false)}
          >
            Отмена
          </Button>
          <Button
            className="bg-[var(--destructive)]"
            disabled={!reason.trim()}
            onClick={async () => {
              await props.onPatch({ status: "rejected", reject_reason: reason });
              setRejectOpen(false);
              setReason("");
            }}
          >
            Отклонить
          </Button>
        </div>
      </Dialog>
    </>
  );
}
