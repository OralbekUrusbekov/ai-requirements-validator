import { useSyncExternalStore } from "react";

/** Высота липких элементов (TopBar + панель секций), чтобы заголовок секции не прятался под ними. */
export const SECTION_OFFSET = 128;

export const sectionElementId = (section: string) => `section-${section}`;

let activeSection = "";
const listeners = new Set<() => void>();

export function setActiveSection(section: string) {
  if (section === activeSection) return;
  activeSection = section;
  listeners.forEach((listener) => listener());
}

export function useActiveSection() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => activeSection,
  );
}

/** Прокручивает к секции (#runs) или к любому элементу с таким id (#FR-01). */
export function scrollToHash(hash: string, behavior: ScrollBehavior = "smooth"): boolean {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (!id) return false;
  const element = document.getElementById(sectionElementId(id)) ?? document.getElementById(id);
  if (!element) return false;
  const top = element.getBoundingClientRect().top + window.scrollY - SECTION_OFFSET;
  window.scrollTo({ top: Math.max(0, top), behavior });
  return true;
}
