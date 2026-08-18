import { formatDistanceToNowStrict, format as formatDate } from "date-fns";
import type { DeploymentState, Provider } from "@shared/models";

export function formatWhen(iso: string | undefined, mode: "relative" | "absolute"): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return mode === "absolute" ? formatDate(date, "MMM d, HH:mm") : `${formatDistanceToNowStrict(date)} ago`;
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
    return error.message;
  }
  return "The request failed.";
}

export async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}
