import { randomUUID } from "node:crypto";
import type { ActivityKind, LocalActivityEntry, Provider } from "@shared/models";
import { getStore } from "./store";

const MAX_ACTIVITY = 500;

export async function listActivity(): Promise<LocalActivityEntry[]> {
  const store = await getStore();
  return store.get("activity") ?? [];
}

export async function addActivity(entry: Omit<LocalActivityEntry, "id" | "at"> & { at?: string }): Promise<LocalActivityEntry> {
  const store = await getStore();
  const next: LocalActivityEntry = {
    id: randomUUID(),
    at: entry.at ?? new Date().toISOString(),
    kind: entry.kind,
    provider: entry.provider,
    title: entry.title,
    detail: entry.detail,
    projectName: entry.projectName,
    targetId: entry.targetId,
    accountId: entry.accountId,
  };
  const items = [next, ...(store.get("activity") ?? [])].slice(0, MAX_ACTIVITY);
  store.set("activity", items);
  return next;
}

export async function clearActivity(): Promise<void> {
  const store = await getStore();
  store.set("activity", []);
}

export function activityFromMutation(
  kind: ActivityKind,
  title: string,
  extras: Partial<Pick<LocalActivityEntry, "detail" | "projectName" | "targetId" | "accountId" | "provider">> = {},
): Omit<LocalActivityEntry, "id" | "at"> {
  return { kind, title, ...extras };
}

export function providerLabel(provider?: Provider | "cloudflare"): string {
  if (provider === "vercel") return "Vercel";
  if (provider === "cloudflare-pages") return "Cloudflare Pages";
  if (provider === "cloudflare-workers") return "Cloudflare Workers";
  if (provider === "cloudflare") return "Cloudflare";
  return "DeployDeck";
}
