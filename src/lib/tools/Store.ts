import type { ExecutionReport } from "./types";

// In-memory ring buffer, server-side, single dev process only. This is
// intentionally NOT meant to survive a server restart or run in production —
// see the process.env.NODE_ENV guard, which is also enforced again at the
// server-fn boundary in serverFns.ts (defense in depth).
const MAX_HISTORY = 50;
const history: ExecutionReport[] = [];

export function recordExecutionReport(report: ExecutionReport): void {
  if (process.env.NODE_ENV === "production") return;
  history.unshift(report);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
}

export function getExecutionHistory(): ExecutionReport[] {
  return history;
}

export function getLatestExecutionReport(): ExecutionReport | null {
  return history[0] ?? null;
}

export function clearExecutionHistory(): void {
  history.length = 0;
}
