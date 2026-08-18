import { create } from "zustand";
import type { DeploymentFilters, Screen, UnifiedDeployment } from "@shared/models";

interface UiState {
  screen: Screen;
  commandOpen: boolean;
  searchNonce: number;
  filters: DeploymentFilters;
  selected?: UnifiedDeployment;
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
  closeInspector: () => void;
  askConfirm: (confirm: NonNullable<UiState["confirm"]>) => void;
  closeConfirm: () => void;
}

export const useUiStore = create<UiState>((set) => ({
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
  closeInspector: () => set({ inspectorOpen: false }),
  askConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: undefined }),
}));
