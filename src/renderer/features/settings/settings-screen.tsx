import type { AppPreferences } from "@shared/models";
import { useQueryClient } from "@tanstack/react-query";
import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SettingRow, SettingsSection } from "@/components/ui/layout";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  Button,
  SegmentedControl,
  SelectControl,
  Skeleton,
  SwitchControl,
  Textarea,
  type SegmentedControlOption,
} from "@/components/ui/primitives";
import { ProviderConnectionRow, useProviderConnection } from "@/features/onboarding/provider-connection";
import { usePrefs } from "@/hooks/use-connection";
import { errorMessage } from "@/lib/format";

const THEME_OPTIONS: ReadonlyArray<SegmentedControlOption<AppPreferences["theme"]>> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const DEFAULT_SCREEN_OPTIONS = [
  { value: "overview", label: "Overview" },
  { value: "deployments", label: "Deployments" },
  { value: "projects", label: "Projects" },
  { value: "domains", label: "Domains" },
  { value: "dns", label: "DNS" },
  { value: "environments", label: "Environments" },
  { value: "activity", label: "Activity" },
];

const TIME_FORMAT_OPTIONS = [
  { value: "relative", label: "Relative time" },
  { value: "absolute", label: "Date and time" },
];

const DENSITY_OPTIONS: ReadonlyArray<SegmentedControlOption<AppPreferences["density"]>> = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
];

const REFRESH_INTERVAL_OPTIONS = [
  { value: "30000", label: "Every 30 seconds" },
  { value: "60000", label: "Every minute" },
  { value: "120000", label: "Every 2 minutes" },
];

const ACTIVE_REFRESH_INTERVAL_OPTIONS = [
  { value: "5000", label: "Every 5 seconds" },
  { value: "10000", label: "Every 10 seconds" },
];

const SETTINGS_SECTIONS = [
  ["connections", "Connections"],
  ["general", "General"],
  ["appearance", "Appearance"],
  ["uploads", "Deploy & upload"],
  ["refresh", "Refresh"],
  ["notifications", "Notifications"],
  ["about", "Setup & version"],
] as const;

type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number][0];

export function SettingsScreen({ onReplaySetup }: { onReplaySetup?: () => void }) {
  const prefs = usePrefs();
  const client = useQueryClient();
  const vercel = useProviderConnection("vercel");
  const cloudflare = useProviderConnection("cloudflare");
  const [version, setVersion] = useState("");
  const [section, setSection] = useState<SettingsSectionId>("connections");

  // Returning null here flashed an empty screen while preferences loaded. The
  // skeleton mirrors the real section rhythm instead.
  if (!prefs.data) {
    return (
      <div className="h-full overflow-auto">
        <div className="w-full max-w-3xl px-6 pt-1 pb-14">
          <div className="grid gap-6" role="status" aria-label="Loading settings">
            {[2].map((rows, index) => (
              <Panel key={index}>
                <PanelHeader
                  size="sm"
                  title={<Skeleton className="h-3.5 w-32" />}
                  description={<Skeleton className="mt-1 h-3 w-72" />}
                />
                <PanelBody padding="none" divided>
                  {Array.from({ length: rows }).map((_, row) => (
                    <div key={row} className="flex min-h-14 items-center justify-between gap-6 px-4 py-3">
                      <div className="min-w-0 grow">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="mt-1.5 h-3 w-64" />
                      </div>
                      <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
                    </div>
                  ))}
                </PanelBody>
              </Panel>
            ))}
          </div>
        </div>
      </div>
    );
  }
  const current = prefs.data;

  const patch = async (next: Partial<AppPreferences>) => {
    try {
      await window.deployDeck.prefs.set(next);
      await client.invalidateQueries({ queryKey: ["prefs"] });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="h-full overflow-auto scroll-smooth">
      <div className="flex w-full max-w-6xl items-start gap-6 px-6 pt-4 pb-14">
        <nav className="sticky top-0 hidden w-40 shrink-0 space-y-1 py-1 min-[1100px]:block" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map(([id, label]) => (
            <button key={id} type="button" aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)} className={section === id ? "block w-full rounded-control bg-panel px-2.5 py-2 text-left text-body font-medium text-ink ring-1 ring-line" : "block w-full rounded-control px-2.5 py-2 text-left text-body text-muted hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"}>
              {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 w-full max-w-3xl">
        <div className="mb-4 flex gap-1 overflow-x-auto pb-1 min-[1100px]:hidden" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map(([id, label]) => (
            <Button key={id} type="button" size="sm" variant={section === id ? "secondary" : "ghost"} onClick={() => setSection(id)}>
              {label}
            </Button>
          ))}
        </div>
        <div className="space-y-6">
          <SettingsSection
            className={section === "connections" ? undefined : "hidden"}
            id="settings-connections"
            size="sm"
            title="Connections"
            description="Sign-in sessions are encrypted by macOS and stay in the Electron main process."
          >
            <ProviderConnectionRow provider={vercel} />
            <ProviderConnectionRow provider={cloudflare} />
          </SettingsSection>

          <SettingsSection
            className={section === "general" ? undefined : "hidden"}
            id="settings-general"
            size="sm"
            title="General"
            description="Choose how DeployDeck starts and where each session begins."
          >
            <SettingRow label="Launch at login" description="Open DeployDeck automatically when you sign in to this Mac.">
              <SwitchControl
                checked={current.launchAtLogin}
                onCheckedChange={(launchAtLogin) => void patch({ launchAtLogin })}
                ariaLabel="Launch DeployDeck at login"
              />
            </SettingRow>
            <SettingRow label="Menu bar icon" description="Keep deployment status and quick actions in the menu bar.">
              <SwitchControl
                checked={current.showTray}
                onCheckedChange={(showTray) => void patch({ showTray })}
                ariaLabel="Show menu bar icon"
              />
            </SettingRow>
            <SettingRow label="Start minimized" description="Launch in the background instead of opening the main window.">
              <SwitchControl
                checked={current.startMinimized}
                onCheckedChange={(startMinimized) => void patch({ startMinimized })}
                ariaLabel="Start DeployDeck minimized"
              />
            </SettingRow>
            <SettingRow label="Default screen" description="The first workspace shown when the app opens.">
              <SelectControl
                value={current.defaultScreen}
                onValueChange={(defaultScreen) =>
                  void patch({ defaultScreen: defaultScreen as AppPreferences["defaultScreen"] })
                }
                options={DEFAULT_SCREEN_OPTIONS}
                ariaLabel="Default screen"
                className="w-48"
              />
            </SettingRow>
            <SettingRow label="Time format" description="Show event times relative to now or as exact dates.">
              <SelectControl
                value={current.timeFormat}
                onValueChange={(timeFormat) =>
                  void patch({ timeFormat: timeFormat as AppPreferences["timeFormat"] })
                }
                options={TIME_FORMAT_OPTIONS}
                ariaLabel="Time format"
                className="w-48"
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            className={section === "appearance" ? undefined : "hidden"}
            id="settings-appearance"
            size="sm"
            title="Appearance"
            description="Tune the interface for your desk and the amount of deployment data you scan."
          >
            <SettingRow label="Theme" description="Match macOS or keep DeployDeck in one appearance.">
              <SegmentedControl
                value={current.theme}
                onValueChange={(theme) => void patch({ theme })}
                options={THEME_OPTIONS}
                ariaLabel="Theme"
              />
            </SettingRow>
            <SettingRow label="Density" description="Adjust row height without changing the amount of information shown.">
              <SegmentedControl
                value={current.density}
                onValueChange={(density) => void patch({ density })}
                options={DENSITY_OPTIONS}
                ariaLabel="Interface density"
              />
            </SettingRow>
            <SettingRow label="Provider icons" description="Show provider marks next to projects and deployments.">
              <SwitchControl
                checked={current.showProviderIcons}
                onCheckedChange={(showProviderIcons) => void patch({ showProviderIcons })}
                ariaLabel="Show provider icons"
              />
            </SettingRow>
            <SettingRow label="Full commit SHA" description="Use complete commit identifiers instead of shortened hashes.">
              <SwitchControl
                checked={current.fullCommitSha}
                onCheckedChange={(fullCommitSha) => void patch({ fullCommitSha })}
                ariaLabel="Show full commit SHA"
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            className={section === "uploads" ? undefined : "hidden"}
            id="settings-uploads"
            size="sm"
            title="Deploy and upload"
            description="Defaults for new deployments and main-process file selection."
          >
            <SettingRow label="Default deployment target" description="Used by the creation workflow unless you explicitly choose another target.">
              <SegmentedControl
                value={current.defaultDeploymentTarget}
                onValueChange={(defaultDeploymentTarget) => void patch({ defaultDeploymentTarget })}
                options={[
                  { value: "preview", label: "Preview" },
                  { value: "production", label: "Production" },
                ]}
                ariaLabel="Default deployment target"
              />
            </SettingRow>
            <SettingRow label="Collapse sidebar" description="Keep the navigation rail compact on wide windows; narrow windows always collapse it.">
              <SwitchControl
                checked={current.sidebarCollapsed}
                onCheckedChange={(sidebarCollapsed) => void patch({ sidebarCollapsed })}
                ariaLabel="Collapse the sidebar"
              />
            </SettingRow>
            <SettingRow className="items-start" label="Ignored upload paths" description="One path or folder name per line. .gitignore is applied as well.">
              <Textarea
                className="w-[min(24rem,42vw)] font-mono text-dense"
                defaultValue={current.localUploadIgnore.join("\n")}
                onBlur={(event) => void patch({ localUploadIgnore: event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) })}
                aria-label="Ignored local upload paths"
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            className={section === "refresh" ? undefined : "hidden"}
            id="settings-refresh"
            size="sm"
            title="Refresh"
            description="Control how often DeployDeck checks providers while it is running."
          >
            <SettingRow label="Background refresh" description="Keep deployments and project status current automatically.">
              <SwitchControl
                checked={current.refreshEnabled}
                onCheckedChange={(refreshEnabled) => void patch({ refreshEnabled })}
                ariaLabel="Enable background refresh"
              />
            </SettingRow>
            <SettingRow label="Normal interval" description="Used when no deployment is actively building.">
              <SelectControl
                value={String(current.refreshIntervalMs)}
                onValueChange={(refreshIntervalMs) =>
                  void patch({
                    refreshIntervalMs: Number(refreshIntervalMs) as AppPreferences["refreshIntervalMs"],
                  })
                }
                options={REFRESH_INTERVAL_OPTIONS}
                ariaLabel="Normal refresh interval"
                className="w-48"
                disabled={!current.refreshEnabled}
              />
            </SettingRow>
            <SettingRow label="Active interval" description="Used while a deployment is queued or building.">
              <SelectControl
                value={String(current.activeRefreshIntervalMs)}
                onValueChange={(activeRefreshIntervalMs) =>
                  void patch({
                    activeRefreshIntervalMs: Number(
                      activeRefreshIntervalMs,
                    ) as AppPreferences["activeRefreshIntervalMs"],
                  })
                }
                options={ACTIVE_REFRESH_INTERVAL_OPTIONS}
                ariaLabel="Active deployment refresh interval"
                className="w-48"
                disabled={!current.refreshEnabled}
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            className={section === "notifications" ? undefined : "hidden"}
            id="settings-notifications"
            size="sm"
            title="Notifications"
            description="Choose which deployment changes should interrupt you."
          >
            <SettingRow label="Production succeeded" description="Notify when a production deployment becomes ready.">
              <SwitchControl
                checked={current.notifyProductionSuccess}
                onCheckedChange={(notifyProductionSuccess) => void patch({ notifyProductionSuccess })}
                ariaLabel="Notify when production succeeds"
              />
            </SettingRow>
            <SettingRow label="Production failed" description="Notify when a production deployment fails.">
              <SwitchControl
                checked={current.notifyProductionFailure}
                onCheckedChange={(notifyProductionFailure) => void patch({ notifyProductionFailure })}
                ariaLabel="Notify when production fails"
              />
            </SettingRow>
            <SettingRow label="Preview failed" description="Notify when a preview deployment fails.">
              <SwitchControl
                checked={current.notifyPreviewFailure}
                onCheckedChange={(notifyPreviewFailure) => void patch({ notifyPreviewFailure })}
                ariaLabel="Notify when a preview fails"
              />
            </SettingRow>
            <SettingRow label="Worker deployment changed" description="Notify after Cloudflare Worker traffic changes.">
              <SwitchControl
                checked={current.notifyWorkerChanged}
                onCheckedChange={(notifyWorkerChanged) => void patch({ notifyWorkerChanged })}
                ariaLabel="Notify when a Worker deployment changes"
              />
            </SettingRow>
            <SettingRow label="Rollback completed" description="Notify after a Pages or Worker rollback finishes.">
              <SwitchControl
                checked={current.notifyRollback}
                onCheckedChange={(notifyRollback) => void patch({ notifyRollback })}
                ariaLabel="Notify when a rollback completes"
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            className={section === "about" ? undefined : "hidden"}
            id="settings-about"
            size="sm"
            title="Setup and version"
            description="Repeat the guided connection flow or check the installed build."
          >
            <SettingRow label="First-run setup" description="Review provider connection and workspace defaults again.">
              <Button type="button" variant="secondary" onClick={onReplaySetup} disabled={!onReplaySetup}>
                Replay setup
              </Button>
            </SettingRow>
            <SettingRow
              label="DeployDeck version"
              description={version ? `Installed version ${version}` : "Read the version reported by the running app."}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  void window.deployDeck.app
                    .getVersion()
                    .then(setVersion)
                    .catch((error) => toast.error(errorMessage(error)))
                }
              >
                {version || "Show version"}
              </Button>
            </SettingRow>
          </SettingsSection>
        </div>
        </div>
      </div>
    </div>
  );
}
