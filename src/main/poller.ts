import { powerMonitor } from "electron";
import { hasToken } from "./credentials";
import { notifyDeploymentTransitions } from "./notifications";
import { getPreferences } from "./preferences";
import { listPagesDeployments, listWorkerDeploymentsAsUnified } from "./providers/cloudflare-client";
import { listVercelDeployments } from "./providers/vercel-client";
import { setupTray, updateTray } from "./tray";
import { getMainWindow, sendToRenderer } from "./window";

let timer: NodeJS.Timeout | null = null;
let sleeping = false;

async function snapshot() {
  const [vercelOn, cloudflareOn] = await Promise.all([hasToken("vercel"), hasToken("cloudflare")]);
  const vercel = vercelOn ? await listVercelDeployments({ limit: 40 }).catch(() => ({ items: [] })) : { items: [] };
  const pages = cloudflareOn ? await listPagesDeployments({ limit: 40 }).catch(() => ({ items: [] })) : { items: [] };
  const workers = cloudflareOn ? await listWorkerDeploymentsAsUnified().catch(() => []) : [];
  const items = [...vercel.items, ...pages.items, ...workers];
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
