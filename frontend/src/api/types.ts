export type Severity = "critical" | "major" | "minor";
export type DefectStatus = "open" | "in_progress" | "fixed" | "rejected";
export type DefectType = "internal" | "context" | "domain";
export type RunStatus = "queued" | "running" | "done" | "error";

export interface ProjectSettings {
  default_model?: string;
  batch_size?: number;
  max_critical?: number;
  criteria?: string[];
}

export interface Project {
  key: string;
  name: string;
  description: string;
  owner: string;
  starred: boolean;
  created_at: string;
  settings: ProjectSettings;
  latest_run?: Run | null;
  open_critical: number;
}

export interface DocumentVersion {
  id: string;
  version: number;
  filename: string;
  sha256: string;
  uploaded_at: string;
}

export interface Document {
  id: string;
  project_key: string;
  name: string;
  created_at: string;
  versions: DocumentVersion[];
}

export interface ContextFile {
  id: string;
  project_key: string;
  type: string;
  filename: string;
  path: string;
  version: number;
  uploaded_at: string;
}

export interface Run {
  id: string;
  project_key: string;
  number: number;
  document_version_id: string;
  document_name: string;
  document_version: number;
  model: string;
  provider: string;
  options: Record<string, unknown>;
  status: RunStatus;
  step: string;
  progress: number;
  started_at?: string;
  finished_at?: string;
  error?: string;
  agent_version?: string;
  requirements_count: number;
  findings_count: number;
  coverage?: number;
  decision?: string;
  duration?: number;
}

export interface Finding {
  criterion: string;
  severity: Severity;
  quote: string;
  related_quotes?: string[];
  requirement_ids?: string[];
  location: string;
  explanation: string;
  fix: string;
  quote_verified: boolean;
  defect_key?: string;
  confidence?: string;
  expert_confirmation?: boolean;
}

export interface Requirement {
  report_id: string;
  source_id: string;
  section: string;
  line_number?: number;
  short_text: string;
  quote: string;
  quote_verified: boolean;
  verdicts?: Record<string, string>;
  defect_keys?: string[];
}

export interface RequirementCheck {
  requirement_id: string;
  verdicts: Record<string, string>;
  findings: Finding[];
  rewrite: string;
}

export interface TraceabilityRow {
  goal: string;
  requirement_ids: string[];
  acceptance_ids: string[];
  api_ids: string[];
  status: string;
}

export interface TestCase {
  id: string;
  requirement_ids: string[];
  preconditions: string[];
  steps: string[];
  expected_result: string;
  boundary_values: string[];
}

export interface Report {
  metadata: Record<string, any>;
  requirements: Requirement[];
  requirement_checks: RequirementCheck[];
  set_check: {
    verdicts: Record<string, string>;
    findings: Finding[];
    missing_sections: string[];
    traceability: string;
    traceability_matrix: TraceabilityRow[];
  };
  summary: Record<string, any>;
  context: Record<string, any>;
  test_cases: TestCase[];
  diff: Record<string, any>;
}

export interface Defect {
  key: string;
  project_key: string;
  number: number;
  fingerprint: string;
  title: string;
  severity: Severity;
  criterion: string;
  type: DefectType;
  status: DefectStatus;
  assignee?: string;
  requirement_ids: string[];
  quotes: string[];
  location: string;
  explanation: string;
  fix: string;
  first_run_id: string;
  last_seen_run_id: string;
  first_run_number?: number | null;
  last_seen_run_number?: number | null;
  reject_reason?: string;
  comments_count: number;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardData {
  kpis: {
    decision?: string;
    requirements: number;
    open_defects: number;
    open_critical: number;
    coverage?: number;
  };
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  by_criterion: Record<string, number>;
  runs_trend: Array<{ number: number; date: string; findings: number }>;
}

export interface ApiConfig {
  provider: string;
  model: string;
  models: string[];
  batch_size: number;
  api_key_configured: boolean;
  mode: string;
}

export interface Comment {
  id: string;
  defect_key: string;
  author: string;
  text: string;
  created_at: string;
}

export interface DefectHistory {
  id: string;
  defect_key: string;
  at: string;
  actor: string;
  action: string;
  details: string;
}

export interface SavedFilter {
  id: string;
  project_key: string;
  name: string;
  query: Record<string, string>;
}

export interface Member {
  name: string;
  role: string;
}

export interface SearchResults {
  projects: Array<{ key: string; name: string }>;
  defects: Array<{ key: string; title: string; project_key: string }>;
  requirements: Array<Requirement & { project_key: string }>;
}
