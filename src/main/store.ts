import Store from "electron-store";
import type { AppPreferences, LocalActivityEntry, WindowBounds } from "@shared/models";
import { DEFAULT_PREFERENCES } from "@shared/models";

interface StoreShape {
  vercelToken?: string;
  cloudflareToken?: string;
  preferences: AppPreferences;
  windowBounds?: WindowBounds;
  activity: LocalActivityEntry[];
}

const store = new Store<StoreShape>({
  name: "deploydeck",
  defaults: {
    preferences: DEFAULT_PREFERENCES,
    activity: [],
  },
});

export async function getStore(): Promise<Store<StoreShape>> {
  return store;
}
