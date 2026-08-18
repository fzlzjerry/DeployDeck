import { Notification } from "electron";
import type { AppPreferences, UnifiedDeployment } from "@shared/models";
import { sendToRenderer, showMainWindow } from "./window";

const seen = new Map<string, string>();
let primed = false;

export function resetNotificationMemory(): void {
  seen.clear();
  primed = false;
}

export function notifyDeploymentTransitions(deployments: UnifiedDeployment[], prefs: AppPreferences): void {
  if (!primed) {
    for (const item of deployments) {
      seen.set(key(item), item.state);
    }
    primed = true;
    return;
  }
  for (const item of deployments) {
    const previous = seen.get(key(item));
    seen.set(key(item), item.state);
    if (!previous || previous === item.state) continue;
    if (item.state === "ready" && item.environment === "production" && prefs.notifyProductionSuccess) {
      fire("Production deployment ready", `${item.projectName} is live.`, item);
    }
    if (item.state === "failed" && item.environment === "production" && prefs.notifyProductionFailure) {
      fire("Production deployment failed", `${item.projectName} failed.`, item);
    }
    if (item.state === "failed" && item.environment === "preview" && prefs.notifyPreviewFailure) {
      fire("Preview deployment failed", `${item.projectName} failed.`, item);
    }
    if (item.provider === "cloudflare-workers" && prefs.notifyWorkerChanged) {
      fire("Worker deployment changed", `${item.projectName} traffic changed.`, item);
    }
    if (previous === "building" && item.state === "ready" && prefs.notifyRollback && /rollback/i.test(item.commitMessage ?? "")) {
      fire("Rollback completed", `${item.projectName} rolled back.`, item);
    }
  }
}

function key(item: UnifiedDeployment): string {
  return `${item.provider}:${item.id}`;
}

function fire(title: string, body: string, item: UnifiedDeployment): void {
  try {
    const notification = new Notification({ title, body, silent: false });
    notification.on("click", () => {
      showMainWindow();
      sendToRenderer("host:open-deployment", {
        provider: item.provider,
        id: item.id,
        projectId: item.projectId,
        accountId: item.accountId,
      });
    });
    notification.show();
  } catch {
    // unsigned development builds may reject notifications
  }
}
