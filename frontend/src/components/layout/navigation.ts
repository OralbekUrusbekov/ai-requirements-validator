import {
  Archive,
  BookOpen,
  Boxes,
  FileSearch,
  GitBranch,
  LayoutDashboard,
  Settings,
  TestTube2,
  type LucideIcon,
} from "lucide-react";

export interface ProjectNavigationItem {
  /** Отдельная страница проекта (например, настройки). */
  path?: string;
  /** Секция на единой странице проекта: /projects/:key#<section>. */
  section?: string;
  label: string;
  icon: LucideIcon;
}

export const projectNavigation: ProjectNavigationItem[] = [
  { section: "overview", label: "Обзор", icon: LayoutDashboard },
  { section: "runs", label: "Прогоны", icon: FileSearch },
  { section: "defects", label: "Дефекты", icon: Boxes },
  { section: "requirements", label: "Требования", icon: BookOpen },
  { section: "traceability", label: "Трассируемость", icon: GitBranch },
  { section: "context", label: "Контекст", icon: Archive },
  { section: "testcases", label: "Тест-кейсы", icon: TestTube2 },
  { path: "settings", label: "Настройки", icon: Settings },
];

export const projectSections = projectNavigation.filter(
  (item): item is ProjectNavigationItem & { section: string } => Boolean(item.section),
);
