import { app, nativeTheme } from "electron";
import started from "electron-squirrel-startup";
import { registerIpc } from "./ipc";
import { setupMenu } from "./menu";
import { applyLoginItem, applyTheme, getPreferences } from "./preferences";
import { startPoller } from "./poller";
import { setupTray } from "./tray";
import { createMainWindow, getMainWindow, sendToRenderer } from "./window";
import { setCloudflareWindow } from "./providers/cloudflare-client";
import { cancelOAuthSession } from "./oauth/session";

if (started) {
  app.quit();
}

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in main process", error);
});
process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection in main process", error);
});

app.setName("DeployDeck");
app.setAboutPanelOptions({
  applicationName: "DeployDeck",
  applicationVersion: app.getVersion(),
  copyright: "A local deployment console for Vercel and Cloudflare",
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  const window = getMainWindow();
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
});

app.whenReady().then(async () => {
  const prefs = await getPreferences();
  applyTheme(prefs.theme);
  applyLoginItem(prefs);
  setupMenu();
  const window = await createMainWindow();
  registerIpc(window);
  setCloudflareWindow(window);
  await setupTray();
  startPoller();
  nativeTheme.on("updated", () => {
    sendToRenderer("host:theme", {
      theme: prefs.theme,
      resolved: nativeTheme.shouldUseDarkColors ? "dark" : "light",
    });
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (!getMainWindow()) {
    void createMainWindow().then((window) => {
      registerIpc(window);
      setCloudflareWindow(window);
    });
  } else {
    getMainWindow()?.show();
  }
});

app.on("before-quit", () => {
  cancelOAuthSession();
  setCloudflareWindow(null);
});
