import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { SectionHeaderProvider } from "../components/layout/AppLayout";
import { projectSections } from "../components/layout/navigation";
import {
  SECTION_OFFSET,
  scrollToHash,
  sectionElementId,
  setActiveSection,
  useActiveSection,
} from "../components/layout/sections";
import { cx } from "../components/ui";
import { ContextPage } from "./Context";
import { Dashboard } from "./Dashboard";
import { Defects } from "./Defects";
import { RequirementsPage } from "./Requirements";
import { Runs } from "./Runs";
import { TestCasesPage } from "./TestCases";
import { TraceabilityPage } from "./Traceability";

const content: Record<string, ReactNode> = {
  overview: <Dashboard />,
  runs: <Runs />,
  defects: <Defects />,
  requirements: <RequirementsPage />,
  traceability: <TraceabilityPage />,
  context: <ContextPage />,
  testcases: <TestCasesPage />,
};

/** Единая страница проекта: все разделы одной лентой с липкой навигацией по секциям. */
export function ProjectPage() {
  const location = useLocation();
  const active = useActiveSection();

  // Переход по #секции (из сайдбара, панели секций или старых ссылок вида /projects/X/runs).
  useEffect(() => {
    if (!location.hash) return;
    let attempts = 0;
    let settleTimer: number | undefined;
    // Данные секций грузятся асинхронно: ждём, пока элемент появится,
    // и один раз доводим прокрутку, когда верхние секции успеют отрисоваться.
    const timer = window.setInterval(() => {
      attempts += 1;
      if (scrollToHash(location.hash) || attempts > 30) {
        window.clearInterval(timer);
        settleTimer = window.setTimeout(() => scrollToHash(location.hash, "auto"), 700);
      }
    }, 100);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(settleTimer);
    };
  }, [location.key]);

  // Подсветка текущей секции при прокрутке.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = projectSections[0].section;
      for (const { section } of projectSections) {
        const element = document.getElementById(sectionElementId(section));
        if (element && element.getBoundingClientRect().top - SECTION_OFFSET <= 8) current = section;
      }
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && window.scrollY > 0) current = projectSections[projectSections.length - 1].section;
      setActiveSection(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.cancelAnimationFrame(frame);
      setActiveSection("");
    };
  }, []);

  return (
    <>
      <nav
        aria-label="Разделы проекта"
        className="sticky top-16 z-20 -mx-4 mb-6 border-b bg-[var(--background)] px-4 py-2 shadow-sm md:-mx-7 md:px-7"
      >
        <div className="scrollbar flex gap-2 overflow-x-auto">
          {projectSections.map(({ section, label, icon: Icon }) => (
            <Link
              key={section}
              to={{ search: location.search, hash: section }}
              aria-current={active === section ? "true" : undefined}
              className={cx(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active === section
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {projectSections.map(({ section, icon }, index) => (
        <section
          key={section}
          id={sectionElementId(section)}
          className={cx(index > 0 && "mt-12 border-t border-[var(--border)] pt-8")}
        >
          {section === "overview" ? (
            content[section]
          ) : (
            <SectionHeaderProvider icon={icon}>{content[section]}</SectionHeaderProvider>
          )}
        </section>
      ))}
    </>
  );
}
