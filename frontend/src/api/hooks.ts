import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, jsonBody } from "./client";
import type {
  ApiConfig,
  DashboardData,
  Defect,
  Document,
  Page,
  Project,
  Report,
  Run,
} from "./types";

export const useConfig = () =>
  useQuery({ queryKey: ["config"], queryFn: () => api<ApiConfig>("/config") });

export const useProjects = () =>
  useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });

export const useProject = (key?: string) =>
  useQuery({
    queryKey: ["project", key],
    queryFn: () => api<Project>(`/projects/${key}`),
    enabled: Boolean(key),
  });

export const useDashboard = (key?: string) =>
  useQuery({
    queryKey: ["dashboard", key],
    queryFn: () => api<DashboardData>(`/projects/${key}/dashboard`),
    enabled: Boolean(key),
  });

export const useDocuments = (key?: string) =>
  useQuery({
    queryKey: ["documents", key],
    queryFn: () => api<Document[]>(`/projects/${key}/documents`),
    enabled: Boolean(key),
  });

export const useRuns = (key?: string) =>
  useQuery({
    queryKey: ["runs", key],
    queryFn: () => api<Run[]>(`/projects/${key}/runs`),
    enabled: Boolean(key),
    refetchInterval: (query) => {
      const runs = query.state.data as Run[] | undefined;
      return runs?.some((run) => ["queued", "running"].includes(run.status)) ? 2000 : false;
    },
  });

export const useRun = (id?: string) =>
  useQuery({
    queryKey: ["run", id],
    queryFn: () => api<Run>(`/runs/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const run = query.state.data as Run | undefined;
      return ["queued", "running"].includes(run?.status ?? "") ? 2000 : false;
    },
  });

export const useReport = (id?: string, enabled = true) =>
  useQuery({
    queryKey: ["report", id],
    queryFn: () => api<Report>(`/runs/${id}/report`),
    enabled: Boolean(id) && enabled,
  });

export const useDefects = (key?: string, params = "") =>
  useQuery({
    queryKey: ["defects", key, params],
    queryFn: () => api<Page<Defect>>(`/projects/${key}/defects?${params}`),
    enabled: Boolean(key),
  });

export function useInvalidate() {
  const queryClient = useQueryClient();
  return (...keys: string[]) =>
    Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

export function useJsonMutation<T = unknown>(
  method: string,
  path: string,
  invalidate: string[] = [],
) {
  const refresh = useInvalidate();
  return useMutation({
    mutationFn: (body: unknown) => api<T>(path, { method, body: jsonBody(body) }),
    onSuccess: () => refresh(...invalidate),
  });
}
