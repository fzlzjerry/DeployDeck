import { randomUUID } from "node:crypto";
import type { ActivityKind, LocalActivityEntry, Provider } from "@shared/models";
import { getStore } from "./store";

const MAX_ACTIVITY = 500;

export async function listActivity(): Promise<LocalActivityEntry[]> {
  const store = await getStore();
  const stored = (store.get("activity") ?? []) as unknown[];
  const migrated = stored.flatMap((value) => migrateActivity(value));
  if (migrated.length !== stored.length || migrated.some((item, index) => item !== stored[index])) {
    store.set("activity", migrated);
  }
  return migrated;
}

function migrateActivity(value: unknown): LocalActivityEntry[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title : typeof row.detail === "string" ? row.detail : undefined;
  if (!title) return [];
  const at = typeof row.at === "string" && Number.isFinite(Date.parse(row.at)) ? row.at : new Date().toISOString();
  const provider = ["vercel", "cloudflare", "cloudflare-pages", "cloudflare-workers"].includes(String(row.provider))
    ? row.provider as LocalActivityEntry["provider"]
    : undefined;
  const item: LocalActivityEntry = {
    id: typeof row.id === "string" && row.id ? row.id : randomUUID(),
    at,
    kind: typeof row.kind === "string" ? row.kind as ActivityKind : "connection-updated",
    provider,
    title,
    detail: typeof row.detail === "string" ? row.detail : undefined,
    projectName: typeof row.projectName === "string" ? row.projectName : undefined,
    targetId: typeof row.targetId === "string" ? row.targetId : undefined,
  };
  const alreadyNormalized = Object.keys(item).every((key) => item[key as keyof LocalActivityEntry] === row[key]);
  return [alreadyNormalized ? value as LocalActivityEntry : item];
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
  extras: Partial<Pick<LocalActivityEntry, "detail" | "projectName" | "targetId" | "provider">> = {},
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
