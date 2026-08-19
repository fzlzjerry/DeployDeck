import type { Provider } from "./models";

export function watchKey(provider: Provider, id: string, accountId?: string): string {
  if (provider === "vercel") return `vercel:${id}`;
  return `${provider}:${accountId ?? ""}:${id}`;
}

export function parseWatchKey(key: string): { provider: Provider; id: string; accountId?: string } | null {
  const [provider, ...rest] = key.split(":");
  if (provider === "vercel" && rest.length >= 1) {
    return { provider: "vercel", id: rest.join(":") };
  }
  if ((provider === "cloudflare-pages" || provider === "cloudflare-workers") && rest.length >= 2) {
    return { provider, accountId: rest[0], id: rest.slice(1).join(":") };
  }
  return null;
}

export function isWatched(keys: string[] | undefined, provider: Provider, id: string, accountId?: string): boolean {
  return Boolean(keys?.includes(watchKey(provider, id, accountId)));
}
