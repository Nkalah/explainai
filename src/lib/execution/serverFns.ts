import { createServerFn } from "@tanstack/react-start";
import { clearExecutionHistory, getExecutionHistory, getLatestExecutionReport } from "./store";
import type { ExecutionReport } from "./types";

const isDev = process.env.NODE_ENV !== "production";

export const fetchExecutionHistory = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExecutionReport[]> => {
    if (!isDev) return [];
    return getExecutionHistory();
  }
);

export const fetchLatestExecutionReport = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExecutionReport | null> => {
    if (!isDev) return null;
    return getLatestExecutionReport();
  }
);

export const clearExecutionHistoryFn = createServerFn({ method: "POST" }).handler(async (): Promise<void> => {
  if (!isDev) return;
  clearExecutionHistory();
});