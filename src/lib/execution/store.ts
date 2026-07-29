// In-memory, dev-only store for ExecutionReports. Intentionally NOT
// persisted anywhere (no DB, no disk) — exists purely to power a local
// development inspector panel. Cleared on every server restart.

import type { ExecutionReport } from "./types";

const MAX_HISTORY = 50;
let history: ExecutionReport[] = [];

export function recordExecutionReport(report: ExecutionReport): void {
  history.unshift(report);
  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }
}

export function getExecutionHistory(): ExecutionReport[] {
  return history;
}

export function getLatestExecutionReport(): ExecutionReport | null {
  return history[0] ?? null;
}

export function clearExecutionHistory(): void {
  history = [];
}