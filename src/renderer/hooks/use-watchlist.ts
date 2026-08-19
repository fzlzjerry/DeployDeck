import { useQueryClient } from "@tanstack/react-query";
import type { Provider } from "@shared/models";
import { isWatched, watchKey } from "@shared/watch";
import { usePrefs } from "./use-connection";

export function useWatchlist() {
  const prefs = usePrefs();
  const client = useQueryClient();
  const keys = prefs.data?.watchedProjectKeys ?? [];

  const toggle = async (provider: Provider, id: string, accountId?: string) => {
    const key = watchKey(provider, id, accountId);
    const next = keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key];
    await window.deployDeck.prefs.set({ watchedProjectKeys: next });
    await client.invalidateQueries({ queryKey: ["prefs"] });
  };

  return {
    keys,
    has: (provider: Provider, id: string, accountId?: string) => isWatched(keys, provider, id, accountId),
    toggle,
  };
}
