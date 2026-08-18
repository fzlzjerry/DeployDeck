import { app, nativeTheme } from "electron";
import type { AppPreferences, ThemePreference, WindowBounds } from "@shared/models";
import { DEFAULT_PREFERENCES } from "@shared/models";
import { getStore } from "./store";

export async function getPreferences(): Promise<AppPreferences> {
  const store = await getStore();
  return { ...DEFAULT_PREFERENCES, ...store.get("preferences") };
}

export async function setPreferences(patch: Partial<AppPreferences>): Promise<AppPreferences> {
  const current = await getPreferences();
  const next = { ...current, ...patch };
  const store = await getStore();
  store.set("preferences", next);
  applyTheme(next.theme);
  applyLoginItem(next);
  return next;
}

export function applyTheme(theme: ThemePreference): void {
  nativeTheme.themeSource = theme;
}

export function applyLoginItem(prefs: AppPreferences): void {
  try {
    app.setLoginItemSettings({
      openAtLogin: prefs.launchAtLogin,
      openAsHidden: prefs.startMinimized,
    });
  } catch {
    // unsigned or sandboxed development builds may not allow login items
  }
}

export async function getWindowBounds(): Promise<WindowBounds | undefined> {
  const store = await getStore();
  return store.get("windowBounds");
}

export async function setWindowBounds(bounds: WindowBounds): Promise<void> {
  const store = await getStore();
  store.set("windowBounds", bounds);
}

export function resolvedTheme(): "light" | "dark" {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}
