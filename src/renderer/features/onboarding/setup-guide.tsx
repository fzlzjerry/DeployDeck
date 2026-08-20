import { useGSAP } from "@gsap/react";
import { useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { ArrowLeft, ArrowRight, Monitor, Moon, Sun } from "lucide-react";
import { useRef } from "react";
import type { AppPreferences, Screen, ThemePreference } from "@shared/models";
import { Lamp, LampBank } from "@/components/common/lamp";
import { Logo } from "@/components/common/logo";
import { ProviderGlyph } from "@/components/common/provider-glyph";
import { SectionHeader, SettingRow, SettingsSection } from "@/components/ui/layout";
import {
  Button,
  SegmentedControl,
  SelectControl,
  SwitchControl,
  type SegmentedControlOption,
} from "@/components/ui/primitives";
import { usePrefs } from "@/hooks/use-connection";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/lib/motion";
import {
  ProviderChannel,
  providerLampState,
  useProviderConnection,
  type ProviderConnectionState,
} from "./provider-connection";
import { StepMeter, useStepFlow, type StepDefinition } from "./setup-steps";

const SCREEN_OPTIONS: Array<{ value: Screen; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "deployments", label: "Deployments" },
  { value: "projects", label: "Projects" },
];

const THEME_OPTIONS: ReadonlyArray<SegmentedControlOption<ThemePreference>> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function stepCopy(id: string, liveCount: number): { title: string; body: string } {
  if (id === "channels") {
    return {
      title: "Bring a channel online",
      body: "One provider is enough to open the workspace. Sign in with the browser, or paste a token. Sessions are encrypted by macOS.",
    };
  }
  if (id === "console") {
    return {
      title: "Set the console",
      body: "Quiet defaults for the way you work. Every one of these is changeable later in Settings.",
    };
  }
  // Reachable with a channel disconnected after the fact, so it must not claim
  // the deck is live when it is not.
  if (liveCount === 0) {
    return {
      title: "No channel is live",
      body: "Go back and connect a provider, or the workspace will open with nothing to show.",
    };
  }
  return {
    title: "The deck is live",
    body:
      liveCount === 2
        ? "Both providers are wired up. Everything below can change in Settings."
        : "You are wired up. The second provider can be added any time from Settings.",
  };
}

export function SetupGuide({ onFinished }: { onFinished: () => void }) {
  const prefs = usePrefs();
  const client = useQueryClient();
  const vercel = useProviderConnection("vercel");
  const cloudflare = useProviderConnection("cloudflare");
  const current = prefs.data;
  const ready = vercel.connected || cloudflare.connected;
  const liveCount = Number(vercel.connected) + Number(cloudflare.connected);

  const steps: StepDefinition[] = [
    { id: "channels", label: "Channels", complete: ready },
    { id: "console", label: "Console" },
    { id: "launch", label: "Launch" },
  ];

  const flow = useStepFlow(steps);
  const shell = useRef<HTMLDivElement>(null);
  const copy = stepCopy(flow.current.id, liveCount);

  const patch = async (next: Partial<AppPreferences>) => {
    await window.deployDeck.prefs.set(next);
    await client.invalidateQueries({ queryKey: ["prefs"] });
  };

  // Power-on: the console comes up once, then gets out of the way.
  useGSAP(
    () => {
      const reduce = prefersReducedMotion();
      if (reduce) return;
      gsap
        .timeline()
        .from("[data-boot='mark']", { autoAlpha: 0, scale: 0.86, duration: 0.5, ease: "back.out(1.6)" })
        .from("[data-boot='meter']", { autoAlpha: 0, y: -6, duration: 0.4, ease: "power3.out" }, "-=0.3")
        .from("[data-boot='chrome']", { autoAlpha: 0, y: 8, duration: 0.45, ease: "power3.out" }, "-=0.28");
    },
    { scope: shell },
  );

  if (!current) return null;

  return (
    <div ref={shell} className="chassis flex h-full flex-col bg-bg">
      <div className="app-drag h-12 shrink-0" />

      <div className="app-no-drag min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[560px] px-8 pb-10">
          <header>
            <div className="flex items-center justify-between gap-6">
              <span data-boot="mark">
                <Logo className="size-10" />
              </span>
              <div className="flex items-center gap-2.5" data-boot="meter">
                <span className="font-mono text-micro text-subtle">{liveCount} of 2 live</span>
                <LampBank states={[providerLampState(vercel), providerLampState(cloudflare)]} />
              </div>
            </div>

            <div className="mt-7" data-boot="meter">
              <StepMeter steps={steps} index={flow.index} onSelect={flow.goTo} />
            </div>
          </header>

          <div data-boot="chrome">
            <div ref={flow.stage} className="overflow-hidden">
              <div className="pt-7">
                <div data-row>
                  <h1 className="text-console font-semibold text-balance text-ink">
                    {copy.title}
                  </h1>
                  <p className="mt-2 text-pretty text-body text-muted">{copy.body}</p>
                </div>

                {flow.current.id === "channels" ? (
                  <div className="mt-6 space-y-2.5">
                    <div data-row>
                      <ProviderChannel provider={vercel} autoFocus={!vercel.connected} />
                    </div>
                    <div data-row>
                      <ProviderChannel
                        provider={cloudflare}
                        autoFocus={vercel.connected && !cloudflare.connected}
                      />
                    </div>
                  </div>
                ) : null}

                {flow.current.id === "console" ? (
                  <div className="mt-6">
                    <div data-row>
                      <SettingsSection
                        size="sm"
                        title="Workspace"
                        description="These follow you into every session."
                        className="max-w-none"
                      >
                        <SettingRow label="Appearance" description="Follow macOS or hold one fixed theme.">
                          <SegmentedControl
                            value={current.theme}
                            onValueChange={(theme) => void patch({ theme })}
                            options={THEME_OPTIONS}
                            ariaLabel="Appearance"
                          />
                        </SettingRow>
                        <SettingRow label="Open to" description="The first view shown when DeployDeck starts.">
                          <SelectControl
                            value={current.defaultScreen}
                            onValueChange={(defaultScreen) => void patch({ defaultScreen: defaultScreen as Screen })}
                            options={SCREEN_OPTIONS}
                            ariaLabel="Default screen"
                            className="w-40"
                          />
                        </SettingRow>
                      </SettingsSection>
                    </div>
                    <div data-row className="mt-4">
                      <SettingsSection
                        size="sm"
                        title="Signals"
                        description="What DeployDeck is allowed to interrupt you for."
                        className="max-w-none"
                      >
                        <SettingRow label="Menu bar access" description="Keep deployment status one click away.">
                          <SwitchControl
                            checked={current.showTray}
                            onCheckedChange={(showTray) => void patch({ showTray })}
                            ariaLabel="Show menu bar icon"
                          />
                        </SettingRow>
                        <SettingRow
                          label="Failure notifications"
                          description="Only notify when production needs attention."
                        >
                          <SwitchControl
                            checked={current.notifyProductionFailure}
                            onCheckedChange={(notifyProductionFailure) => void patch({ notifyProductionFailure })}
                            ariaLabel="Notify when production fails"
                          />
                        </SettingRow>
                      </SettingsSection>
                    </div>
                  </div>
                ) : null}

                {flow.current.id === "launch" ? (
                  <div className="mt-6 space-y-2.5">
                    <div data-row>
                      <ChannelSummary provider={vercel} />
                    </div>
                    <div data-row>
                      <ChannelSummary provider={cloudflare} />
                    </div>
                    <div data-row className="pt-2">
                      <SectionHeader
                        size="sm"
                        title="Opening to"
                        description={`${SCREEN_OPTIONS.find((item) => item.value === current.defaultScreen)?.label ?? "Overview"} · ${current.theme} appearance · menu bar ${current.showTray ? "on" : "off"}`}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-line bg-surface/60">
        <div className="mx-auto flex w-full max-w-[560px] items-center justify-between gap-4 px-8 py-3.5">
          <div className="flex items-center gap-3">
            {flow.isFirst ? (
              <p className={cn("flex items-center gap-2 text-dense", ready ? "text-ready-ink" : "text-muted")}>
                <Lamp state={ready ? "live" : "off"} />
                {ready ? "Channel live" : "Connect a provider to continue"}
              </p>
            ) : (
              <Button variant="ghost" size="sm" className="text-muted" onClick={flow.back}>
                <ArrowLeft aria-hidden />
                Back
              </Button>
            )}
          </div>

          {flow.isLast ? (
            <Button disabled={!ready} onClick={onFinished}>
              Open DeployDeck
            </Button>
          ) : (
            <Button disabled={!flow.canAdvance} onClick={flow.next}>
              Continue
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function ChannelSummary({ provider }: { provider: ProviderConnectionState }) {
  const live = provider.connected;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-panel px-4 py-3",
        live ? "bg-surface shadow-[inset_0_0_0_1px_var(--line)]" : "bg-surface/45",
      )}
    >
      <ProviderGlyph brand={provider.id} className={cn("size-[18px]", live ? "text-ink" : "text-subtle")} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-body font-medium", live ? "text-ink" : "text-subtle")}>{provider.name}</p>
        {live ? <p className="truncate text-dense text-muted">{provider.account ?? "Connected"}</p> : null}
      </div>
      <Lamp state={live ? "live" : "off"} />
    </div>
  );
}

export function CompactConnect({ onReplaySetup }: { onReplaySetup: () => void }) {
  const vercel = useProviderConnection("vercel");
  const cloudflare = useProviderConnection("cloudflare");
  const faulted = providerLampState(vercel) === "fault" || providerLampState(cloudflare) === "fault";
  const shell = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from("[data-row]", {
        autoAlpha: 0,
        y: 14,
        duration: 0.5,
        stagger: 0.07,
        ease: "power3.out",
        clearProps: "transform",
      });
    },
    { scope: shell },
  );

  return (
    <div ref={shell} className="chassis flex h-full flex-col bg-bg">
      <div className="app-drag h-12 shrink-0" />
      <main className="app-no-drag mx-auto flex min-h-0 w-full max-w-[560px] flex-1 flex-col justify-center px-8 pb-10">
        <header data-row>
          <Logo className="size-10" />
          <h1 className="mt-5 text-console font-semibold text-ink">
            Both channels are dark
          </h1>
          <p className="mt-2 text-pretty text-body text-muted">
            {faulted
              ? "That sign-in was not accepted. Try again, or paste a token to bring the deck back online."
              : "Bring either provider back online to load projects and deployments."}
          </p>
        </header>
        <div className="mt-7 space-y-2.5">
          <div data-row>
            <ProviderChannel provider={vercel} autoFocus={!vercel.connected} />
          </div>
          <div data-row>
            <ProviderChannel provider={cloudflare} autoFocus={vercel.connected && !cloudflare.connected} />
          </div>
        </div>
        <div data-row className="mt-5">
          <Button variant="ghost" size="sm" className="text-muted" onClick={onReplaySetup}>
            Review console setup
          </Button>
        </div>
      </main>
    </div>
  );
}
