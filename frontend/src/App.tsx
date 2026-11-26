import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ContextPage } from "./pages/Context";
import { Dashboard } from "./pages/Dashboard";
import { Defects } from "./pages/Defects";
import { Projects } from "./pages/Projects";
import { ReportPage } from "./pages/Report";
import { RequirementsPage } from "./pages/Requirements";
import { Runs } from "./pages/Runs";
import { SettingsPage } from "./pages/Settings";
import { TestCasesPage } from "./pages/TestCases";
import { TraceabilityPage } from "./pages/Traceability";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Projects />} />
        <Route path="/projects/:key" element={<Dashboard />} />
        <Route path="/projects/:key/runs" element={<Runs />} />
        <Route path="/projects/:key/runs/:runId" element={<ReportPage />} />
        <Route path="/projects/:key/defects" element={<Defects />} />
        <Route path="/projects/:key/requirements" element={<RequirementsPage />} />
        <Route path="/projects/:key/traceability" element={<TraceabilityPage />} />
        <Route path="/projects/:key/context" element={<ContextPage />} />
        <Route path="/projects/:key/testcases" element={<TestCasesPage />} />
        <Route path="/projects/:key/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
