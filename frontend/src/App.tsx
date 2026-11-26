import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProjectPage } from "./pages/ProjectPage";
import { Projects } from "./pages/Projects";
import { ReportPage } from "./pages/Report";
import { SettingsPage } from "./pages/Settings";

/** Старые адреса разделов ведут на секцию единой страницы проекта: /projects/X/runs → /projects/X#runs. */
function SectionRedirect({ section }: { section: string }) {
  const { key } = useParams();
  const { search, hash } = useLocation();
  return <Navigate replace to={{ pathname: `/projects/${key}`, search, hash: hash || section }} />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Projects />} />
        <Route path="/projects/:key" element={<ProjectPage />} />
        <Route path="/projects/:key/runs" element={<SectionRedirect section="runs" />} />
        <Route path="/projects/:key/runs/:runId" element={<ReportPage />} />
        <Route path="/projects/:key/defects" element={<SectionRedirect section="defects" />} />
        <Route path="/projects/:key/requirements" element={<SectionRedirect section="requirements" />} />
        <Route path="/projects/:key/traceability" element={<SectionRedirect section="traceability" />} />
        <Route path="/projects/:key/context" element={<SectionRedirect section="context" />} />
        <Route path="/projects/:key/testcases" element={<SectionRedirect section="testcases" />} />
        <Route path="/projects/:key/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
