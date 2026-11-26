import { useEffect, useState } from "react";
import { ClipboardCheck, Menu, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { mockMode } from "../../api/client";
import type { ApiConfig } from "../../api/types";
import { Badge, Button } from "../ui";
import { GlobalSearch } from "./GlobalSearch";

function getInitialTheme(): "light" | "dark" {
  const saved = localStorage.getItem("requirements-theme");
  if (saved === "light" || saved === "dark") return saved;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function TopBar({
  activeProject,
  config,
  onMenu,
}: {
  activeProject?: string;
  config?: ApiConfig;
  onMenu: () => void;
}) {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("requirements-theme", theme);
  }, [theme]);

  return (
    <header className="topbar sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-[var(--card)] px-4">
      <Button
        aria-label="Открыть меню"
        className="border-0 bg-transparent p-2 text-current lg:hidden"
        onClick={onMenu}
      >
        <Menu />
      </Button>
      <GlobalSearch />
      <Badge className="hidden bg-[var(--secondary)] sm:inline-flex">
        {mockMode ? "MOCK API" : "LIVE API"}
      </Badge>
      <span className="hidden text-xs md:block">
        Ключ модели настроен: {config?.api_key_configured ? "да" : "нет"}
      </span>
      {activeProject && (
        <Button
          className="border-0 bg-[var(--gold)] text-[var(--gold-foreground)]"
          onClick={() => navigate(`/projects/${activeProject}/runs?new=true`)}
        >
          <ClipboardCheck size={18} />
          <span className="hidden sm:inline">Новая проверка</span>
        </Button>
      )}
      <Button
        aria-label="Переключить тему"
        className="border bg-transparent p-2 text-current"
        onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
      >
        {theme === "dark" ? <Sun /> : <Moon />}
      </Button>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-white">
        АП
      </span>
    </header>
  );
}
