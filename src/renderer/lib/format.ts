import { format as formatDate, isThisYear, isToday, isYesterday } from "date-fns";
import type { DeploymentState, Provider } from "@shared/models";

/** Stable key for grouping a timeline by calendar day. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  return formatDate(date, "yyyy-MM-dd");
}

/** Heading for a day group: relative for the recent past, dated before that. */
export function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return formatDate(date, isThisYear(date) ? "EEEE, MMM d" : "MMM d, yyyy");
}

export function formatWhen(iso: string | undefined, mode: "relative" | "absolute"): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  if (mode === "absolute") return formatDate(date, "MMM d, HH:mm");
  const elapsed = Date.now() - date.getTime();
  if (elapsed < 0) return formatDate(date, "MMM d, yyyy");
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date, "MMM d, yyyy");
}

export function formatDuration(ms?: number): string {
  if (ms === undefined || Number.isNaN(ms)) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function shortSha(sha?: string, full = false): string {
  if (!sha) return "—";
  return full || sha.length <= 8 ? sha : sha.slice(0, 7);
}

export function providerLabel(provider: Provider): string {
  if (provider === "vercel") return "Vercel";
  if (provider === "cloudflare-pages") return "Pages";
  return "Workers";
}

export function stateLabel(state: DeploymentState): string {
  return state[0].toUpperCase() + state.slice(1);
}

export function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return unwrapIpcError(error.message);
  }
  if (typeof error === "string") return unwrapIpcError(error);
  return "The request failed.";
}

function unwrapIpcError(message: string): string {
  const match = message.match(/^Error invoking remote method '[^']+': ([\s\S]+)$/);
  const inner = match?.[1] ?? message;
  if (inner === "[object Object]") return "The request failed.";
  return inner;
}

export async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}
