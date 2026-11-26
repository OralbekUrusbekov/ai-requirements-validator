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
  path: string;
  label: string;
  icon: LucideIcon;
}

export const projectNavigation: ProjectNavigationItem[] = [
  { path: "", label: "Обзор", icon: LayoutDashboard },
  { path: "runs", label: "Прогоны", icon: FileSearch },
  { path: "defects", label: "Дефекты", icon: Boxes },
  { path: "requirements", label: "Требования", icon: BookOpen },
  { path: "traceability", label: "Трассируемость", icon: GitBranch },
  { path: "context", label: "Контекст", icon: Archive },
  { path: "testcases", label: "Тест-кейсы", icon: TestTube2 },
  { path: "settings", label: "Настройки", icon: Settings },
];
