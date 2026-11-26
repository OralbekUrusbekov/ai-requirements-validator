import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { X } from "lucide-react";

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function Button({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 py-2",
        "text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className ??
          "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "card rounded-lg border bg-[var(--card)] p-5 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "min-h-10 w-full min-w-0 truncate rounded-lg border bg-[var(--card)] pl-3 pr-8 text-sm",
        "outline-none placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "min-h-24 w-full resize-y rounded-lg border bg-[var(--card)] px-3 py-2",
        "outline-none placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "min-h-10 w-full rounded-lg border bg-[var(--card)] px-3",
        "outline-none focus:ring-2 focus:ring-[var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-[var(--muted)]", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="py-14 text-center">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-[var(--muted-foreground)]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <Card className="border-red-300 bg-red-50 text-red-950 dark:bg-red-950/20 dark:text-red-100">
      <h2 className="font-bold">Не удалось загрузить данные</h2>
      <p className="mt-1">{error.message}</p>
      {retry && (
        <Button className="mt-4 border-red-300 bg-transparent text-current" onClick={retry}>
          Повторить
        </Button>
      )}
    </Card>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="inline-flex" title={text} aria-label={text}>
      {children}
    </span>
  );
}

export interface TabItem {
  id: string;
  label: string;
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-4 overflow-x-auto border-b">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={cx(
            "whitespace-nowrap border-b-2 px-1 py-3 text-sm",
            value === item.id
              ? "border-[var(--primary)] font-semibold"
              : "border-transparent text-[var(--muted-foreground)]",
          )}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [open, onClose]);
}

export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEscape(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <Card className="max-h-[90vh] w-full max-w-xl overflow-auto">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <Button className="border-0 bg-transparent p-2 text-current" onClick={onClose}>
            <X aria-label="Закрыть" />
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
}

export function Sheet({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEscape(open, onClose);
  return (
    <div
      className={cx(
        "fixed inset-0 z-50 transition",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Закрыть панель"
        onClick={onClose}
        className={cx(
          "absolute inset-0 bg-black/40 transition",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        className={cx(
          "scrollbar absolute right-0 top-0 h-full w-full overflow-y-auto border-l",
          "bg-[var(--card)] p-6 shadow-xl transition sm:w-[45%]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <Button className="border-0 bg-transparent p-2 text-current" onClick={onClose}>
            <X aria-label="Закрыть" />
          </Button>
        </div>
        {children}
      </aside>
    </div>
  );
}

interface ToastItem {
  id: number;
  text: string;
  kind: "ok" | "error";
}

interface ToastContextValue {
  push: (text: string, kind?: ToastItem["kind"]) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  function push(text: string, kind: ToastItem["kind"] = "ok") {
    const id = Date.now();
    setItems((current) => [...current, { id, text, kind }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 3500);
  }

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[70] grid gap-2" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={cx(
              "max-w-sm rounded-lg px-4 py-3 text-white shadow-lg",
              item.kind === "error" ? "bg-[var(--destructive)]" : "bg-[var(--primary-deep)]",
            )}
          >
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
