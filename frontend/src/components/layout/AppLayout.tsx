import { routeLabels } from "../../lib/labels";
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { useConfig, useProjects } from "../../api/hooks";
import { Button, cx } from "../ui";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppLayout() {
  const { key } = useParams();
  const location = useLocation();
  const projects = useProjects();
  const config = useConfig();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const sidebar = (
    <Sidebar
      activeProject={key}
      collapsed={collapsed}
      projects={projects.data ?? []}
      projectSearch={projectSearch}
      onProjectSearch={setProjectSearch}
      onCollapse={() => setCollapsed((value) => !value)}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <div className="min-h-screen">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Закрыть меню"
            onClick={() => setMobileOpen(false)}
          />
          {sidebar}
          <Button
            className="absolute right-3 top-3 border-0 bg-transparent p-2 text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X aria-label="Закрыть" />
          </Button>
        </div>
      )}
      <div className={cx("page-shell transition-all", collapsed ? "lg:ml-20" : "lg:ml-72")}>
        <TopBar
          activeProject={key}
          config={config.data}
          onMenu={() => setMobileOpen(true)}
        />
        <main className="mx-auto min-w-0 max-w-[1500px] overflow-x-hidden p-4 md:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const location = useLocation();
  const path = location.pathname.split("/").filter(Boolean);
  return (
    <>
      <div className="mb-2 text-sm text-[var(--muted-foreground)]">
        Проекты {path[1] ? `/ ${path[1]}` : ""} {path[2] ? `/ ${routeLabels[path[2]] ?? path[2]}` : ""}
        {path[3] ? ` / ${path[2] === "runs" ? "Отчёт" : path[3]}` : ""}
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-[var(--muted-foreground)]">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </>
  );
}
