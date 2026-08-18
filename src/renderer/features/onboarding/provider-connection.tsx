import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CLOUDFLARE_TOKEN_URL, VERCEL_TOKEN_URL } from "@shared/provider-types";
import { Lamp, LampReadout, type LampState } from "@/components/common/lamp";
import { ProviderTile } from "@/components/common/provider-glyph";
import { SettingRow } from "@/components/ui/layout";
import { Button, Input, Label } from "@/components/ui/primitives";
import { useConnect, useConnection } from "@/hooks/use-connection";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";

export type ProviderId = "vercel" | "cloudflare";

const PROVIDER_META: Record<ProviderId, { name: string; tokenUrl: string }> = {
  vercel: { name: "Vercel", tokenUrl: VERCEL_TOKEN_URL },
  cloudflare: { name: "Cloudflare", tokenUrl: CLOUDFLARE_TOKEN_URL },
};

export interface ProviderConnectionState {
  id: ProviderId;
  name: string;
  tokenUrl: string;
  connected: boolean;
  /** Who or what the saved token resolves to, once verified. */
  account?: string;
  checking: boolean;
  connecting: boolean;
  disconnecting: boolean;
  error?: string;
  connect: (token: string) => void;
  disconnect: () => void;
  openTokenPage: () => void;
}

/**
 * Single source of truth for a provider's connection state. Setup, reconnect and
 * Settings all read from here so the same task cannot drift into three behaviours.
 */
export function useProviderConnection(id: ProviderId): ProviderConnectionState {
  const meta = PROVIDER_META[id];
  const connection = useConnection();
  const connect = useConnect();
  const mutation = id === "vercel" ? connect.vercel : connect.cloudflare;

  const vercel = connection.data?.vercel;
  const cloudflare = connection.data?.cloudflare;
  const connected = Boolean(id === "vercel" ? vercel?.connected : cloudflare?.connected);

  let account: string | undefined;
  if (id === "vercel") {
    account = vercel?.userEmail ?? vercel?.userName;
  } else if (cloudflare?.connected) {
    const count = cloudflare.accounts.length;
    account = `${count} ${count === 1 ? "account" : "accounts"} available`;
  }

  return {
    id,
    name: meta.name,
    tokenUrl: meta.tokenUrl,
    connected,
    account,
    checking: connection.isLoading,
    connecting: mutation.isPending,
    disconnecting: connect.disconnect.isPending && connect.disconnect.variables === id,
    error: mutation.isError ? errorMessage(mutation.error) : undefined,
    connect: (token: string) =>
      mutation.mutate(token, {
        onSuccess: () => toast.success(connected ? `${meta.name} token replaced` : `${meta.name} connected`),
      }),
    disconnect: () =>
      connect.disconnect.mutate(id, {
        onSuccess: () => toast.success(`${meta.name} disconnected`),
        onError: (error) => toast.error(errorMessage(error)),
      }),
    openTokenPage: () => void window.deployDeck.shell.openHttps(meta.tokenUrl),
  };
}

export function ConnectionStatusPill({
  connected,
  checking,
  className,
}: {
  connected: boolean;
  checking?: boolean;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1 text-[11px] font-medium",
        connected ? "bg-ready-soft text-ready" : "bg-surface-2 text-muted",
        className,
      )}
    >
      <Lamp state={connected ? "live" : "off"} className="size-3.5" />
      {checking ? "Checking…" : connected ? "Connected" : "Not connected"}
    </span>
  );
}

/**
 * The token entry form. A real <form> so Return submits and macOS password
 * autofill behaves, rather than a hand-rolled keydown handler.
 */
export function ProviderTokenForm({
  provider,
  autoFocus,
  className,
}: {
  provider: ProviderConnectionState;
  autoFocus?: boolean;
  className?: string;
}) {
  const [token, setToken] = useState("");
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const { connected, connecting, error } = provider;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = token.trim();
    if (!value || connecting) return;
    provider.connect(value);
    setToken("");
  };

  return (
    <form className={cn("space-y-2", className)} onSubmit={submit}>
      <Label htmlFor={inputId} className="sr-only">
        {provider.name} API token
      </Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          type="password"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={token}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => setToken(event.target.value)}
          placeholder={connected ? `Paste a new ${provider.name} token` : `Paste your ${provider.name} token`}
          className="font-mono text-[12px] placeholder:font-sans placeholder:text-[13px]"
        />
        <Button type="submit" size="default" loading={connecting} disabled={!token.trim()}>
          {connected ? "Replace" : "Connect"}
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="flex gap-1.5 text-[12px] leading-4 text-failed">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </form>
  );
}

function TokenPageButton({ provider }: { provider: ProviderConnectionState }) {
  return (
    <Button variant="ghost" size="sm" className="text-muted" onClick={provider.openTokenPage}>
      Open token page
      <ExternalLink aria-hidden />
    </Button>
  );
}

function DisconnectButton({ provider }: { provider: ProviderConnectionState }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted hover:text-failed"
      loading={provider.disconnecting}
      onClick={provider.disconnect}
    >
      Disconnect
    </Button>
  );
}

export function providerLampState(provider: ProviderConnectionState): LampState {
  if (provider.connected) return "live";
  if (provider.connecting) return "verifying";
  if (provider.error) return "fault";
  return "off";
}

/**
 * Setup and reconnect presentation: a channel strip on the console. Inert
 * until you feed it a token, then the lamp carries the state and the input
 * collapses away because it has no further job.
 */
export function ProviderChannel({
  provider,
  autoFocus,
}: {
  provider: ProviderConnectionState;
  autoFocus?: boolean;
}) {
  const { connected } = provider;
  const lamp = providerLampState(provider);
  const root = useRef<HTMLDivElement>(null);
  const wasConnected = useRef(connected);

  // Going live is the one moment worth choreographing: the slot closes and the
  // lamp washes the strip it sits on.
  useGSAP(
    () => {
      const changed = wasConnected.current !== connected;
      wasConnected.current = connected;
      if (!changed) return;

      const bloom = root.current?.querySelector("[data-bloom]");
      const slot = root.current?.querySelector("[data-slot]");
      const reduce = prefersReducedMotion();
      const tl = gsap.timeline();

      if (slot) {
        tl.from(slot, {
          height: 0,
          autoAlpha: 0,
          duration: reduce ? 0 : 0.32,
          ease: "power3.out",
          clearProps: "height",
        });
      }
      if (bloom && connected) {
        tl.fromTo(bloom, { autoAlpha: 0 }, { autoAlpha: 1, duration: reduce ? 0 : 0.6, ease: "power2.out" }, 0);
      }
    },
    { dependencies: [connected], scope: root },
  );

  return (
    <div
      ref={root}
      className={cn(
        "relative overflow-hidden rounded-xl bg-surface px-4 py-3.5",
        "shadow-[inset_0_0_0_1px_var(--line)]",
      )}
    >
      {connected ? (
        <span
          data-bloom
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-40"
          style={{
            background:
              "radial-gradient(90% 120% at 100% 50%, color-mix(in oklch, var(--ready-lamp) 16%, transparent), transparent 70%)",
          }}
        />
      ) : null}

      <div className="relative flex items-center gap-3">
        <ProviderTile brand={provider.id} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-ink">{provider.name}</p>
          <p className="truncate text-[12px] text-muted">
            {connected ? (provider.account ?? "Token verified") : "Personal access token"}
          </p>
        </div>
        <LampReadout state={lamp} />
        {connected ? <DisconnectButton provider={provider} /> : <TokenPageButton provider={provider} />}
      </div>

      {!connected ? (
        <div data-slot className="relative overflow-hidden">
          {/* A recessed well: the slot you feed the token into. */}
          <div className="mt-3.5 rounded-lg bg-surface-sunken p-2.5 shadow-[inset_0_1px_3px_oklch(0_0_0/0.18)]">
            <ProviderTokenForm provider={provider} autoFocus={autoFocus} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Settings presentation: the same behaviour inside the shared SettingRow chrome.
 */
export function ProviderConnectionRow({ provider }: { provider: ProviderConnectionState }) {
  const detail = provider.connected
    ? (provider.account ?? "Token verified")
    : provider.checking
      ? "Checking connection…"
      : "No account connected";

  return (
    <SettingRow
      className="items-start"
      label={
        <span className="flex items-center gap-2">
          <span>{provider.name}</span>
          <ConnectionStatusPill connected={provider.connected} checking={provider.checking} />
        </span>
      }
      description={detail}
    >
      <div className="w-[min(28rem,46vw)] space-y-2">
        <ProviderTokenForm provider={provider} />
        <div className="flex items-center gap-2">
          <TokenPageButton provider={provider} />
          {provider.connected ? <DisconnectButton provider={provider} /> : null}
        </div>
      </div>
    </SettingRow>
  );
}
