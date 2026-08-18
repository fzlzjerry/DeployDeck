import { Menu, app, shell } from "electron";
import { CLOUDFLARE_DOCS_URL, VERCEL_DOCS_URL } from "@shared/provider-types";
import { sendToRenderer, showMainWindow } from "./window";

export function setupMenu(): void {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              {
                label: "Settings…",
                accelerator: "CmdOrCtrl+,",
                click: () => {
                  showMainWindow();
                  sendToRenderer("host:navigate", { screen: "settings" });
                },
              },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Refresh",
          accelerator: "CmdOrCtrl+R",
          click: () => sendToRenderer("host:refresh"),
        },
        {
          label: "Refresh All",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => sendToRenderer("host:refresh-all"),
        },
        {
          label: "Open Selected Item",
          click: () => sendToRenderer("host:open-selected"),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        nav("Overview", "1", "overview"),
        nav("Deployments", "2", "deployments"),
        nav("Projects", "3", "projects"),
        nav("Domains", "4", "domains"),
        nav("DNS", "5", "dns"),
        nav("Environments", "6", "environments"),
        nav("Activity", "7", "activity"),
        { type: "separator" },
        {
          label: "Command Palette",
          accelerator: "CmdOrCtrl+K",
          click: () => sendToRenderer("host:open-command-palette"),
        },
        {
          label: "Find",
          accelerator: "CmdOrCtrl+F",
          click: () => sendToRenderer("host:focus-search"),
        },
        { type: "separator" },
        ...(MAIN_WINDOW_VITE_DEV_SERVER_URL
          ? ([{ role: "reload" }, { role: "toggleDevTools" }] as Electron.MenuItemConstructorOptions[])
          : []),
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Vercel Documentation",
          click: () => void shell.openExternal(VERCEL_DOCS_URL),
        },
        {
          label: "Cloudflare Documentation",
          click: () => void shell.openExternal(CLOUDFLARE_DOCS_URL),
        },
        {
          label: "DeployDeck README",
          click: () => void shell.openExternal("https://github.com/moraxc/DeployDeck"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function nav(label: string, key: string, screen: string): Electron.MenuItemConstructorOptions {
  return {
    label,
    accelerator: `CmdOrCtrl+${key}`,
    click: () => {
      showMainWindow();
      sendToRenderer("host:navigate", { screen });
    },
  };
}
