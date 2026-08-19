import { create } from "zustand";
import type {
  CreateResourceKind,
  DeploymentFilters,
  EnvironmentFocus,
  ProjectFocus,
  Screen,
  UnifiedDeployment,
} from "@shared/models";

interface UiState {
  screen: Screen;
  commandOpen: boolean;
  searchNonce: number;
  filters: DeploymentFilters;
  selected?: UnifiedDeployment;
  inspectorOpen: boolean;
  projectFocus?: ProjectFocus;
  zoneFocus?: string;
  environmentFocus?: EnvironmentFocus;
  createResource?: CreateResourceKind;
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
  openProject: (focus: ProjectFocus) => void;
  openZone: (zoneId: string) => void;
  openEnvironment: (focus: EnvironmentFocus) => void;
  openCreate: (kind: CreateResourceKind) => void;
  closeCreate: () => void;
  openSelected: () => void;
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
  openProject: (projectFocus) => set({ projectFocus, screen: "projects" }),
  openZone: (zoneFocus) => set({ zoneFocus, screen: "dns" }),
  openEnvironment: (environmentFocus) => set({ environmentFocus, screen: "environments" }),
  openCreate: (createResource) => set({ createResource }),
  closeCreate: () => set({ createResource: undefined }),
  openSelected: () =>
    set((state) => {
      if (state.selected) return { screen: "deployments", inspectorOpen: true };
      if (state.projectFocus) return { screen: "projects" };
      if (state.zoneFocus) return { screen: "dns" };
      return state;
    }),
  closeInspector: () => set({ inspectorOpen: false }),
  askConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: undefined }),
}));
