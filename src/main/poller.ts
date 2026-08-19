import { powerMonitor } from "electron";
import type { UnifiedDeployment } from "@shared/models";
import { parseWatchKey } from "@shared/watch";
import { hasToken } from "./credentials";
import { notifyDeploymentTransitions } from "./notifications";
import { getPreferences } from "./preferences";
import { listPagesDeployments, listWorkerDeployments, listWorkerDeploymentsAsUnified } from "./providers/cloudflare-client";
import { workerDeploymentAsUnified } from "./providers/cloudflare-normalize";
import { listVercelDeployments } from "./providers/vercel-client";
import { setupTray, updateTray } from "./tray";
import { getMainWindow, sendToRenderer } from "./window";

let timer: NodeJS.Timeout | null = null;
let sleeping = false;

function mergeDeployments(items: UnifiedDeployment[]): UnifiedDeployment[] {
  const seen = new Set<string>();
  const merged: UnifiedDeployment[] = [];
  for (const item of items) {
    const key = `${item.provider}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function watchedDeployments(keys: string[]): Promise<UnifiedDeployment[]> {
  const items: UnifiedDeployment[] = [];
  for (const key of keys.slice(0, 24)) {
    const parsed = parseWatchKey(key);
    if (!parsed) continue;
    try {
      if (parsed.provider === "vercel") {
        const page = await listVercelDeployments({ projectId: parsed.id, limit: 8 });
        items.push(...page.items);
      } else if (parsed.provider === "cloudflare-pages" && parsed.accountId) {
        const page = await listPagesDeployments({
          accountId: parsed.accountId,
          projectName: parsed.id,
          limit: 8,
        });
        items.push(...page.items);
      } else if (parsed.provider === "cloudflare-workers" && parsed.accountId) {
        const rows = await listWorkerDeployments(parsed.accountId, parsed.id);
        items.push(
          ...rows.map((row) =>
            workerDeploymentAsUnified(row, parsed.id, { id: row.accountId, name: row.accountName }),
          ),
        );
      }
    } catch {
      // a watched project that fails must not stop the rest of the snapshot
    }
  }
  return items;
}

async function snapshot() {
  const [vercelOn, cloudflareOn] = await Promise.all([hasToken("vercel"), hasToken("cloudflare")]);
  const prefs = await getPreferences();
  const vercel = vercelOn ? await listVercelDeployments({ limit: 40 }).catch(() => ({ items: [] })) : { items: [] };
  const pages = cloudflareOn ? await listPagesDeployments({ limit: 40 }).catch(() => ({ items: [] })) : { items: [] };
  const workers = cloudflareOn ? await listWorkerDeploymentsAsUnified().catch(() => []) : [];
  const watched = await watchedDeployments(prefs.watchedProjectKeys ?? []);
  const items = mergeDeployments([...vercel.items, ...pages.items, ...workers, ...watched]);
  const active = items.filter((item) => item.state === "queued" || item.state === "building");
  const failed = items
    .filter((item) => item.state === "failed")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const latestReady = items
    .filter((item) => item.state === "ready" && item.environment === "production")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  return { items, active, failed, latestReady };
}

async function tick(): Promise<void> {
  if (sleeping) return;
  const prefs = await getPreferences();
  if (!prefs.refreshEnabled) return;
  await setupTray();
  if (!prefs.showTray && getMainWindow()?.isVisible()) return;
  try {
    const result = await snapshot();
    updateTray(result);
    notifyDeploymentTransitions(result.items, prefs);
  } catch {
    // keep the last tray state
  }
}

export function startPoller(): void {
  stopPoller();
  const run = () => {
    void tick();
    void getPreferences().then((prefs) => {
      const window = getMainWindow();
      const hidden = !window || !window.isVisible();
      const delay = hidden ? 60_000 : prefs.refreshIntervalMs;
      timer = setTimeout(run, delay);
    });
  };
  run();
  powerMonitor.on("suspend", () => {
    sleeping = true;
    sendToRenderer("host:power-suspend");
  });
  powerMonitor.on("resume", () => {
    sleeping = false;
    sendToRenderer("host:power-resume");
    void tick();
  });
}

export function stopPoller(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}
