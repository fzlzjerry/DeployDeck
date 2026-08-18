import { Menu, Tray } from "electron";
import type { UnifiedDeployment } from "@shared/models";
import { getPreferences } from "./preferences";
import { trayImage } from "./tray-icons";
import { sendToRenderer, showMainWindow } from "./window";

let tray: Tray | null = null;

function truncate(value: string, length = 42): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export async function setupTray(): Promise<void> {
  const prefs = await getPreferences();
  if (!prefs.showTray) {
    destroyTray();
    return;
  }
  if (!tray) {
    tray = new Tray(trayImage("idle"));
    tray.setToolTip("DeployDeck");
  }
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

export function updateTray(snapshot: {
  active: UnifiedDeployment[];
  failed: UnifiedDeployment[];
  latestReady?: UnifiedDeployment;
}): void {
  if (!tray) return;
  const kind = snapshot.active.length > 0 ? "building" : snapshot.failed.length > 0 ? "failed" : "idle";
  tray.setImage(trayImage(kind));
  const active = snapshot.active.slice(0, 3);
  const failed = snapshot.failed.slice(0, 3);
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: `${snapshot.active.length} active`, enabled: false },
    { type: "separator" },
  ];
  if (active.length === 0) {
    template.push({ label: "No active deployments", enabled: false });
  } else {
    for (const item of active) {
      template.push({
        label: truncate(`${item.projectName} · ${item.provider}`),
        click: () => openDeployment(item),
      });
    }
  }
  template.push({ type: "separator" }, { label: "Recent failures", enabled: false });
  if (failed.length === 0) {
    template.push({ label: "None", enabled: false });
  } else {
    for (const item of failed) {
      template.push({
        label: truncate(`${item.projectName} · failed`),
        click: () => openDeployment(item),
      });
    }
  }
  if (snapshot.latestReady) {
    template.push(
      { type: "separator" },
      {
        label: truncate(`Latest production · ${snapshot.latestReady.projectName}`),
        click: () => openDeployment(snapshot.latestReady!),
      },
    );
  }
  template.push(
    { type: "separator" },
    { label: "Refresh", click: () => sendToRenderer("host:refresh-all") },
    { label: "Open DeployDeck", click: () => showMainWindow() },
    {
      label: "Settings",
      click: () => {
        showMainWindow();
        sendToRenderer("host:navigate", { screen: "settings" });
      },
    },
    { role: "quit" },
  );
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function openDeployment(item: UnifiedDeployment): void {
  showMainWindow();
  sendToRenderer("host:open-deployment", {
    provider: item.provider,
    id: item.id,
    projectId: item.projectId,
    accountId: item.accountId,
  });
}
