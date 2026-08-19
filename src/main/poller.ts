import { powerMonitor } from "electron";
import { cloudflareCapabilities } from "@shared/oauth";
import { hasToken, readCredential } from "./credentials";
import { notifyDeploymentTransitions } from "./notifications";
import { getPreferences } from "./preferences";
import { listPagesDeployments, listWorkerDeploymentsAsUnified } from "./providers/cloudflare-client";
import { listVercelDeployments } from "./providers/vercel-client";
import { setupTray, updateTray } from "./tray";
import { getMainWindow, sendToRenderer } from "./window";

let timer: NodeJS.Timeout | null = null;
let sleeping = false;

async function snapshot() {
  const [vercelOn, cloudflareCredential] = await Promise.all([hasToken("vercel"), readCredential("cloudflare")]);
  const cloudflare = cloudflareCapabilities(cloudflareCredential);
  const vercel = vercelOn ? await listVercelDeployments({ limit: 40 }).catch(() => ({ items: [] })) : { items: [] };
  const pages = cloudflare.pages ? await listPagesDeployments({ limit: 40 }).catch(() => ({ items: [] })) : { items: [] };
  const workers = cloudflare.workers ? await listWorkerDeploymentsAsUnified().catch(() => []) : [];
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

async function tick(): Promise<number> {
  const prefs = await getPreferences();
  const window = getMainWindow();
  const hidden = !window || !window.isVisible();
  const idleDelay = hidden ? 60_000 : prefs.refreshIntervalMs;
  if (sleeping || !prefs.refreshEnabled) return idleDelay;
  await setupTray();
  if (!prefs.showTray && window?.isVisible()) return idleDelay;
  try {
    const result = await snapshot();
    updateTray(result);
    notifyDeploymentTransitions(result.items, prefs);
    if (!hidden && result.active.length > 0) return prefs.activeRefreshIntervalMs;
  } catch {
    // keep the last tray state
  }
  return idleDelay;
}

export function startPoller(): void {
  stopPoller();
  const run = () => {
    void tick().then((delay) => {
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
