import { ChevronLeft, FolderKanban, Plus } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import type { Project } from "../../api/types";
import { Button, Input, cx } from "../ui";
import { projectNavigation } from "./navigation";

interface SidebarProps {
  activeProject?: string;
  collapsed: boolean;
  projects: Project[];
  projectSearch: string;
  onProjectSearch: (value: string) => void;
  onCollapse: () => void;
  onNavigate?: () => void;
}

export function Sidebar(props: SidebarProps) {
  const query = props.projectSearch.toLocaleLowerCase("ru");
  const projects = props.projects.filter(
    (project) =>
      project.name.toLocaleLowerCase("ru").includes(query) ||
      project.key.toLocaleLowerCase("ru").includes(query),
  );

  return (
    <aside
      className={cx(
        "flex h-full flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-all",
        props.collapsed ? "w-20" : "w-72",
      )}
    >
      <Link
        to="/"
        onClick={props.onNavigate}
        className="flex items-center gap-3 border-b border-[var(--sidebar-border)] p-4"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--gold)] font-bold text-[var(--gold-foreground)]">
          B
        </span>
        {!props.collapsed && (
          <span>
            <b>Requirements</b>
            <small className="block text-[var(--sidebar-muted)]">Review platform</small>
          </span>
        )}
      </Link>

      <div className="scrollbar flex-1 overflow-y-auto p-3">
        <NavLink
          to="/"
          onClick={props.onNavigate}
          className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-[var(--sidebar-accent)]"
        >
          <FolderKanban />
          {!props.collapsed && "Все проекты"}
        </NavLink>

        {!props.collapsed && (
          <Input
            value={props.projectSearch}
            onChange={(event) => props.onProjectSearch(event.target.value)}
            placeholder="Поиск проекта…"
            aria-label="Поиск проекта"
            className="mb-3 border-[var(--sidebar-border)] bg-transparent"
          />
        )}

        {projects.map((project) => {
          const active = props.activeProject === project.key;
          return (
            <div key={project.key}>
              <NavLink
                to={`/projects/${project.key}`}
                onClick={props.onNavigate}
                className={cx(
                  "flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-[var(--sidebar-accent)]",
                  active && "bg-[var(--sidebar-accent)]",
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-bold">
                  {project.key.slice(0, 2)}
                </span>
                {!props.collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    <span className="text-[var(--gold)]">{project.starred ? "★" : "☆"}</span>
                  </>
                )}
              </NavLink>

              {active && !props.collapsed && (
                <nav className="ml-7 border-l border-[var(--sidebar-border)] pl-2">
                  {projectNavigation.map(({ path, label, icon: Icon }) => (
                    <NavLink
                      end={!path}
                      key={path}
                      to={`/projects/${project.key}${path ? `/${path}` : ""}`}
                      onClick={props.onNavigate}
                      className={({ isActive }) =>
                        cx(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                          "text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-accent)]",
                          isActive && "bg-[var(--sidebar-accent)] text-[var(--gold)]",
                        )
                      }
                    >
                      <Icon size={16} />
                      {label}
                    </NavLink>
                  ))}
                </nav>
              )}
            </div>
          );
        })}

        {!props.collapsed && (
          <Link
            to="/?create=true"
            onClick={props.onNavigate}
            className="mt-3 flex items-center gap-2 px-3 py-2 font-semibold text-[var(--gold)]"
          >
            <Plus /> Создать проект
          </Link>
        )}
      </div>

      <Button
        className="m-3 border-[var(--sidebar-border)] bg-transparent text-inherit"
        onClick={props.onCollapse}
      >
        <ChevronLeft className={cx(props.collapsed && "rotate-180")} />
        {!props.collapsed && "Свернуть"}
      </Button>
    </aside>
  );
}
