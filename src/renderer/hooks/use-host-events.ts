import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { HostOpenDeploymentPayload } from "@shared/api-contract";
import type { Screen } from "@shared/models";
import { useUiStore } from "@/stores/ui-store";

export function useHostEvents() {
  const queryClient = useQueryClient();
  const setScreen = useUiStore((state) => state.setScreen);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const focusSearch = useUiStore((state) => state.focusSearch);
  const openDeployment = useUiStore((state) => state.openDeployment);
  const closeInspector = useUiStore((state) => state.closeInspector);

  useEffect(() => {
    if (!window.deployDeck) return;
    const off = [
      window.deployDeck.on<{ screen: Screen }>("host:navigate", (payload) => setScreen(payload.screen)),
      window.deployDeck.on("host:refresh", () => {
        void queryClient.invalidateQueries();
      }),
      window.deployDeck.on("host:refresh-all", () => {
        void queryClient.invalidateQueries();
      }),
      window.deployDeck.on("host:power-resume", () => {
        void queryClient.invalidateQueries();
      }),
      window.deployDeck.on("host:connection-changed", () => {
        void queryClient.invalidateQueries();
      }),
      window.deployDeck.on("host:open-command-palette", () => setCommandOpen(true)),
      window.deployDeck.on("host:focus-search", () => focusSearch()),
      window.deployDeck.on<HostOpenDeploymentPayload>("host:open-deployment", async (payload) => {
        setScreen("deployments");
        try {
          if (payload.provider === "vercel") {
            const detail = await window.deployDeck.vercel.getDeployment(payload.id);
            openDeployment(detail);
          } else if (payload.provider === "cloudflare-pages" && payload.accountId && payload.projectId) {
            const detail = await window.deployDeck.cloudflare.getPagesDeployment(
              payload.accountId,
              payload.projectId,
              payload.id,
            );
            openDeployment(detail);
          } else {
            openDeployment({
              id: payload.id,
              provider: payload.provider,
              accountId: payload.accountId ?? "",
              accountName: "",
              projectId: payload.projectId ?? "",
              projectName: payload.projectId ?? "",
              state: "unknown",
              environment: "unknown",
              aliases: [],
              createdAt: new Date().toISOString(),
            });
          }
        } catch {
          setScreen("deployments");
        }
      }),
    ];
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCommandOpen(false);
        closeInspector();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      off.forEach((unsub) => unsub());
      window.removeEventListener("keydown", onKey);
    };
  }, [closeInspector, focusSearch, openDeployment, queryClient, setCommandOpen, setScreen]);
}
