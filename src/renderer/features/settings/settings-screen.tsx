import type { AppPreferences } from "@shared/models";
import { useQueryClient } from "@tanstack/react-query";
import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SectionHeader, SettingRow, SettingsSection } from "@/components/ui/layout";
import {
  Button,
  SegmentedControl,
  SelectControl,
  SwitchControl,
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

export function SettingsScreen({ onReplaySetup }: { onReplaySetup?: () => void }) {
  const prefs = usePrefs();
  const client = useQueryClient();
  const vercel = useProviderConnection("vercel");
  const cloudflare = useProviderConnection("cloudflare");
  const [version, setVersion] = useState("");

  if (!prefs.data) return null;
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
    <div className="h-full overflow-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-7 pb-14">
        <SectionHeader
          title="Settings"
          description="Manage providers, workspace behavior, and the signals DeployDeck keeps an eye on."
        />

        <div className="mt-8 space-y-8">
          <SettingsSection
            size="sm"
            title="Connections"
            description="Sign-in sessions are encrypted by macOS and stay in the Electron main process."
            className="max-w-none"
          >
            <ProviderConnectionRow provider={vercel} />
            <ProviderConnectionRow provider={cloudflare} />
          </SettingsSection>

          <SettingsSection
            size="sm"
            title="General"
            description="Choose how DeployDeck starts and where each session begins."
            className="max-w-none"
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
            size="sm"
            title="Appearance"
            description="Tune the interface for your desk and the amount of deployment data you scan."
            className="max-w-none"
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
            size="sm"
            title="Refresh"
            description="Control how often DeployDeck checks providers while it is running."
            className="max-w-none"
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
            size="sm"
            title="Notifications"
            description="Choose which deployment changes should interrupt you."
            className="max-w-none"
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
            size="sm"
            title="Setup and version"
            description="Repeat the guided connection flow or check the installed build."
            className="max-w-none"
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
  );
}

