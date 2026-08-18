import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Cloud,
  ExternalLink,
  KeyRound,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AppPreferences, Screen, ThemePreference } from "@shared/models";
import { CLOUDFLARE_TOKEN_URL, VERCEL_TOKEN_URL } from "@shared/provider-types";
import { Logo } from "@/components/common/logo";
import {
  Button,
  Input,
  Label,
  SelectControl,
  SwitchControl,
} from "@/components/ui/primitives";
import { useConnect, useConnection, usePrefs } from "@/hooks/use-connection";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/format";

const SCREEN_OPTIONS: Array<{ value: Screen; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "deployments", label: "Deployments" },
  { value: "projects", label: "Projects" },
];

export function SetupGuide({ onFinished }: { onFinished: () => void }) {
  const connection = useConnection();
  const prefs = usePrefs();
  const client = useQueryClient();
  const current = prefs.data;
  const ready = Boolean(connection.data?.vercel.connected || connection.data?.cloudflare.connected);
  const vercel = useConnectState("vercel");
  const cloudflare = useConnectState("cloudflare");

  const patch = async (next: Partial<AppPreferences>) => {
    await window.deployDeck.prefs.set(next);
    await client.invalidateQueries({ queryKey: ["prefs"] });
  };

  if (!current) return null;

  return (
    <div className="relative h-full overflow-hidden bg-bg">
      <div className="app-drag absolute inset-x-0 top-0 z-10 h-12" />
      <div className="mx-auto grid h-full w-full max-w-[1080px] grid-cols-[290px_minmax(0,1fr)] gap-10 px-8 pt-16 pb-8">
        <aside className="flex min-h-0 flex-col border-r border-line pr-10">
          <Logo className="size-11" />
          <h1 className="mt-6 text-[24px] font-semibold tracking-[-0.03em] text-wrap-balance">
            Your deployment desk, in one window.
          </h1>
          <p className="mt-3 max-w-[29ch] text-[13px] leading-5 text-muted text-pretty">
            Connect one provider, choose how the workspace behaves, and start working. No product tour in between.
          </p>

          <div className="mt-8 space-y-3 text-[12px] text-muted">
            <Assurance icon={<ShieldCheck />} title="Local credentials">
              Tokens are encrypted by macOS and stay outside the renderer.
            </Assurance>
            <Assurance icon={<KeyRound />} title="Least access first">
              Either Vercel or Cloudflare is enough to open the workspace.
            </Assurance>
          </div>

          <p className="mt-auto text-[11px] leading-4 text-subtle">
            You can replace tokens and change every preference later in Settings.
          </p>
        </aside>

        <main className="app-no-drag min-h-0 overflow-auto pr-1">
          <header>
            <h2 className="text-[18px] font-semibold tracking-[-0.02em]">Set up DeployDeck</h2>
            <p className="mt-1 text-[13px] text-muted">Connect an account and tune the defaults you use every day.</p>
          </header>

          <section className="mt-7" aria-labelledby="setup-connections">
            <SectionHeading id="setup-connections" title="Connections" description="A token is verified before it is saved." />
            <div className="mt-3 space-y-2">
              <ProviderField
                id="setup-vercel"
                name="Vercel"
                mark="V"
                tokenUrl={VERCEL_TOKEN_URL}
                connected={Boolean(connection.data?.vercel.connected)}
                connectedAs={connection.data?.vercel.userName ?? connection.data?.vercel.userEmail}
                pending={vercel.pending}
                error={vercel.error}
                onConnect={vercel.connect}
              />
              <ProviderField
                id="setup-cloudflare"
                name="Cloudflare"
                mark="CF"
                tokenUrl={CLOUDFLARE_TOKEN_URL}
                connected={Boolean(connection.data?.cloudflare.connected)}
                connectedAs={
                  connection.data?.cloudflare.connected
                    ? `${connection.data.cloudflare.accounts.length} account${connection.data.cloudflare.accounts.length === 1 ? "" : "s"}`
                    : undefined
                }
                pending={cloudflare.pending}
                error={cloudflare.error}
                onConnect={cloudflare.connect}
              />
            </div>
          </section>

          <section className="mt-8 border-t border-line pt-7" aria-labelledby="setup-workspace">
            <SectionHeading id="setup-workspace" title="Workspace" description="Quiet defaults for the way you work." />
            <div className="mt-4 space-y-1">
              <PreferenceRow label="Appearance" description="Follow macOS or keep a fixed theme.">
                <div className="flex rounded-md bg-surface p-0.5" role="radiogroup" aria-label="Appearance">
                  {([
                    ["system", "System", Monitor],
                    ["light", "Light", Sun],
                    ["dark", "Dark", Moon],
                  ] as Array<[ThemePreference, string, typeof Monitor]>).map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={current.theme === value}
                      onClick={() => void patch({ theme: value })}
                      className={cn(
                        "flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px]",
                        current.theme === value ? "bg-bg text-ink" : "text-muted hover:text-ink",
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>
              </PreferenceRow>
              <PreferenceRow label="Open to" description="The first view shown when DeployDeck starts.">
                <SelectControl
                  value={current.defaultScreen}
                  onValueChange={(defaultScreen) => void patch({ defaultScreen: defaultScreen as Screen })}
                  options={SCREEN_OPTIONS}
                  ariaLabel="Default screen"
                  className="w-40"
                />
              </PreferenceRow>
              <PreferenceRow label="Menu bar access" description="Keep deployment status one click away.">
                <SwitchControl
                  checked={current.showTray}
                  onCheckedChange={(showTray) => void patch({ showTray })}
                  ariaLabel="Show menu bar icon"
                />
              </PreferenceRow>
              <PreferenceRow label="Failure notifications" description="Only notify when production needs attention.">
                <SwitchControl
                  checked={current.notifyProductionFailure}
                  onCheckedChange={(notifyProductionFailure) => void patch({ notifyProductionFailure })}
                  ariaLabel="Notify when production fails"
                />
              </PreferenceRow>
            </div>
          </section>

          <footer className="mt-7 flex items-center justify-between border-t border-line pt-5">
            <p className={cn("flex items-center gap-1.5 text-[12px]", ready ? "text-ready" : "text-muted")}>
              {ready ? <Check className="size-3.5" aria-hidden /> : <Cloud className="size-3.5" aria-hidden />}
              {ready ? "Ready to open" : "Connect either provider to continue"}
            </p>
            <Button disabled={!ready} onClick={onFinished}>
              Open DeployDeck
            </Button>
          </footer>
        </main>
      </div>
    </div>
  );
}

type Provider = "vercel" | "cloudflare";

function useConnectState(provider: Provider) {
  const connect = useConnect();
  const mutation = provider === "vercel" ? connect.vercel : connect.cloudflare;
  return {
    pending: mutation.isPending,
    error: mutation.isError ? errorMessage(mutation.error) : undefined,
    connect: (token: string) => mutation.mutate(token),
  };
}

function ProviderField({
  id,
  name,
  mark,
  tokenUrl,
  connected,
  connectedAs,
  pending,
  error,
  onConnect,
}: {
  id: string;
  name: string;
  mark: string;
  tokenUrl: string;
  connected: boolean;
  connectedAs?: string;
  pending: boolean;
  error?: string;
  onConnect: (token: string) => void;
}) {
  const [token, setToken] = useState("");

  return (
    <div className="rounded-lg bg-surface px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-bg text-[10px] font-semibold text-ink" aria-hidden>
          {mark}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Label htmlFor={id} className="text-ink">{name}</Label>
            {connected ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ready">
                <Check className="size-3" aria-hidden /> Connected
              </span>
            ) : null}
          </div>
          {connected ? (
            <p className="truncate text-[12px] text-muted">{connectedAs ?? "Token verified"}</p>
          ) : (
            <p className="text-[12px] text-muted">Personal access token</p>
          )}
        </div>
        <Button variant="ghost" size="sm" className="text-muted" onClick={() => void window.deployDeck.shell.openHttps(tokenUrl)}>
          Get token <ExternalLink className="size-3" aria-hidden />
        </Button>
      </div>

      {!connected ? (
        <div className="mt-3 flex gap-2 pl-11">
          <Input
            id={id}
            type="password"
            autoComplete="off"
            value={token}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => setToken(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && token.trim() && !pending) onConnect(token.trim());
            }}
            placeholder={`Paste ${name} token`}
          />
          <Button
            size="sm"
            loading={pending}
            disabled={!token.trim() || pending}
            onClick={() => onConnect(token.trim())}
          >
            Verify
          </Button>
        </div>
      ) : null}
      {error ? <p id={`${id}-error`} role="alert" className="mt-2 pl-11 text-[12px] text-failed">{error}</p> : null}
    </div>
  );
}

function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div>
      <h3 id={id} className="text-[13px] font-semibold">{title}</h3>
      <p className="mt-0.5 text-[12px] text-muted">{description}</p>
    </div>
  );
}

function PreferenceRow({ label, description, children }: { label: string; description: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-6 border-b border-line/70 py-2.5 last:border-b-0">
      <div>
        <p className="text-[13px] font-medium">{label}</p>
        <p className="mt-0.5 text-[12px] text-muted">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Assurance({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 [&>svg]:size-3.5 [&>svg]:text-ember" aria-hidden>{icon}</span>
      <p className="leading-[18px]">
        <span className="font-medium text-ink">{title}.</span> {children}
      </p>
    </div>
  );
}

export function CompactConnect({ onReplaySetup }: { onReplaySetup: () => void }) {
  const connection = useConnection();
  const vercel = useConnectState("vercel");
  const cloudflare = useConnectState("cloudflare");

  return (
    <div className="relative h-full bg-bg">
      <div className="app-drag absolute inset-x-0 top-0 h-12" />
      <main className="app-no-drag mx-auto flex h-full w-full max-w-[680px] flex-col justify-center px-8 pb-10">
        <div className="flex items-center gap-3">
          <Logo className="size-9" />
          <div>
            <h1 className="text-[18px] font-semibold tracking-[-0.02em]">Reconnect your workspace</h1>
            <p className="text-[12px] text-muted">Connect either provider to load projects and deployments.</p>
          </div>
        </div>
        <div className="mt-7 space-y-2">
          <ProviderField
            id="reconnect-vercel"
            name="Vercel"
            mark="V"
            tokenUrl={VERCEL_TOKEN_URL}
            connected={Boolean(connection.data?.vercel.connected)}
            connectedAs={connection.data?.vercel.userName ?? connection.data?.vercel.userEmail}
            pending={vercel.pending}
            error={vercel.error}
            onConnect={vercel.connect}
          />
          <ProviderField
            id="reconnect-cloudflare"
            name="Cloudflare"
            mark="CF"
            tokenUrl={CLOUDFLARE_TOKEN_URL}
            connected={Boolean(connection.data?.cloudflare.connected)}
            connectedAs={
              connection.data?.cloudflare.connected
                ? `${connection.data.cloudflare.accounts.length} account${connection.data.cloudflare.accounts.length === 1 ? "" : "s"}`
                : undefined
            }
            pending={cloudflare.pending}
            error={cloudflare.error}
            onConnect={cloudflare.connect}
          />
        </div>
        <button type="button" className="mt-5 self-start text-[12px] text-muted hover:text-ink" onClick={onReplaySetup}>
          Review workspace setup
        </button>
      </main>
    </div>
  );
}
