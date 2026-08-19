import { create } from "zustand";
import type { DeploymentFilters, Provider, Screen, UnifiedDeployment, UnifiedProject } from "@shared/models";

export type ProjectFocus =
  | { kind: "project"; provider: Exclude<Provider, "cloudflare-workers">; id: string; accountId: string; name: string; accountName: string }
  | { kind: "worker"; accountId: string; name: string; accountName: string };

interface UiState {
  screen: Screen;
  commandOpen: boolean;
  searchNonce: number;
  filters: DeploymentFilters;
  selected?: UnifiedDeployment;
  selectedProject?: ProjectFocus;
  selectedZoneId?: string;
  inspectorOpen: boolean;
  confirm?: {
    title: string;
    body: string;
    actionLabel: string;
    intent?: "default" | "warning" | "danger";
    onConfirm: () => Promise<void> | void;
  };
  setScreen: (screen: Screen) => void;
  setCommandOpen: (open: boolean) => void;
  focusSearch: () => void;
  setFilters: (patch: Partial<DeploymentFilters>) => void;
  openDeployment: (deployment: UnifiedDeployment) => void;
  openProject: (project: ProjectFocus) => void;
  openZone: (zoneId: string) => void;
  openSelected: () => void;
  closeInspector: () => void;
  askConfirm: (confirm: NonNullable<UiState["confirm"]>) => void;
  closeConfirm: () => void;
}

export function projectToFocus(project: UnifiedProject): ProjectFocus {
  return {
    kind: "project",
    provider: project.provider === "cloudflare-workers" ? "cloudflare-pages" : project.provider,
    id: project.id,
    accountId: project.accountId,
    name: project.name,
    accountName: project.accountName,
  };
}

export const useUiStore = create<UiState>((set, get) => ({
  screen: "overview",
  commandOpen: false,
  searchNonce: 0,
  filters: { provider: "all", accountId: "all", state: "all", environment: "all" },
  inspectorOpen: false,
  setScreen: (screen) => set({ screen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  focusSearch: () => set((state) => ({ searchNonce: state.searchNonce + 1 })),
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  openDeployment: (selected) => set({ selected, inspectorOpen: true, screen: "deployments" }),
  openProject: (selectedProject) => set({ selectedProject, screen: "projects" }),
  openZone: (selectedZoneId) => set({ selectedZoneId, screen: "dns" }),
  openSelected: () => {
    const state = get();
    if (state.selected) {
      set({ inspectorOpen: true, screen: "deployments" });
      return;
    }
    if (state.selectedProject) {
      set({ screen: "projects" });
      return;
    }
    if (state.selectedZoneId) {
      set({ screen: "dns" });
    }
  },
  closeInspector: () => set({ inspectorOpen: false }),
  askConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: undefined }),
}));
