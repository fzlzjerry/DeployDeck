import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { isOAuthCancelledMessage } from "@shared/oauth";
import { CLOUDFLARE_TOKEN_URL, VERCEL_TOKEN_URL } from "@shared/provider-types";
import { Lamp, LampReadout, type LampState } from "@/components/common/lamp";
import { ProviderGlyph, ProviderTile } from "@/components/common/provider-glyph";
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
  oauthAvailable: boolean;
  authKind?: "oauth" | "pat";
  grantedScopes: string[];
  /** Who or what the saved token resolves to, once verified. */
  account?: string;
  checking: boolean;
  connecting: boolean;
  oauthConnecting: boolean;
  oauthBlocked: boolean;
  disconnecting: boolean;
  error?: string;
  connect: (token: string) => void;
  signIn: () => void;
  cancelSignIn: () => void;
  disconnect: () => void;
  openTokenPage: () => void;
}

function visibleError(error: unknown): string | undefined {
  if (!error) return undefined;
  const message = errorMessage(error);
  if (isOAuthCancelledMessage(message)) return undefined;
  return message;
}

/**
 * Single source of truth for a provider's connection state. Setup, reconnect and
 * Settings all read from here so the same task cannot drift into three behaviours.
 */
export function useProviderConnection(id: ProviderId): ProviderConnectionState {
  const meta = PROVIDER_META[id];
  const connection = useConnection();
  const connect = useConnect();
  const paste = id === "vercel" ? connect.vercel : connect.cloudflare;
  const oauthForThis = connect.oauth.isPending && connect.oauth.variables === id;

  const vercel = connection.data?.vercel;
  const cloudflare = connection.data?.cloudflare;
  const connected = Boolean(id === "vercel" ? vercel?.connected : cloudflare?.connected);
  const oauthAvailable = Boolean(connection.data?.oauth[id]);
  const authKind = id === "vercel" ? vercel?.authKind : cloudflare?.authKind;
  const grantedScopes = id === "vercel" ? (vercel?.grantedScopes ?? []) : (cloudflare?.grantedScopes ?? []);

  let account: string | undefined;
  if (id === "vercel") {
    account = vercel?.userEmail ?? vercel?.userName;
  } else if (cloudflare?.connected) {
    const count = cloudflare.accounts.length;
    account = `${count} ${count === 1 ? "account" : "accounts"} available`;
  }

  const pasteError = paste.isError ? visibleError(paste.error) : undefined;
  const oauthError =
    connect.oauth.isError && connect.oauth.variables === id ? visibleError(connect.oauth.error) : undefined;

  return {
    id,
    name: meta.name,
    tokenUrl: meta.tokenUrl,
    connected,
    oauthAvailable,
    authKind,
    grantedScopes,
    account,
    checking: connection.isLoading,
    connecting: paste.isPending,
    oauthConnecting: oauthForThis,
    oauthBlocked: connect.oauth.isPending && connect.oauth.variables !== id,
    disconnecting: connect.disconnect.isPending && connect.disconnect.variables === id,
    error: oauthError ?? pasteError,
    connect: (token: string) =>
      paste.mutate(token, {
        onSuccess: () => toast.success(connected ? `${meta.name} token replaced` : `${meta.name} connected`),
      }),
    signIn: () =>
      connect.oauth.mutate(id, {
        onSuccess: (status) => {
          if (status) toast.success(connected ? `${meta.name} reconnected` : `${meta.name} connected`);
        },
        onError: (error) => {
          const message = visibleError(error);
          if (message) toast.error(message);
        },
      }),
    cancelSignIn: () => void window.deployDeck.connections.cancelOAuth(),
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
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-1 text-label font-medium",
        connected ? "border-ready-ink/25 bg-ready-soft text-ready-ink" : "border-line bg-surface-2 text-muted",
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
  const { connected, connecting, oauthConnecting, error } = provider;
  const busy = connecting || oauthConnecting;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = token.trim();
    if (!value || busy) return;
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
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => setToken(event.target.value)}
          placeholder={connected ? `Paste a new ${provider.name} token` : `Paste your ${provider.name} token`}
          className="font-mono text-dense placeholder:font-sans placeholder:text-body"
        />
        {/* Once connected, replacing the credential is a secondary recovery
            path. It stays visually quieter than a first-time connection. */}
        <Button
          type="submit"
          variant={connected ? "secondary" : "default"}
          loading={connecting}
          disabled={!token.trim() || busy}
        >
          {connected ? "Replace" : "Connect"}
        </Button>
      </div>
      {error ? <p id={errorId} className="sr-only">{error}</p> : null}
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
      className="text-muted hover:text-failed-ink"
      loading={provider.disconnecting}
      onClick={provider.disconnect}
    >
      Disconnect
    </Button>
  );
}

function SignInButton({
  provider,
  reconnect,
  compact = false,
}: {
  provider: ProviderConnectionState;
  reconnect?: boolean;
  compact?: boolean;
}) {
  if (provider.oauthConnecting) {
    return (
      <div className="flex items-center gap-2">
        <Button type="button" size={compact ? "sm" : "default"} loading disabled>
          Waiting for browser…
        </Button>
        <Button type="button" variant="ghost" size="sm" className="text-muted" onClick={provider.cancelSignIn}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size={compact ? "sm" : "default"}
      variant={reconnect ? "secondary" : "default"}
      onClick={provider.signIn}
      disabled={!provider.oauthAvailable || provider.connecting || provider.oauthBlocked}
      title={provider.oauthAvailable ? undefined : "Set the OAuth client ID in .env to enable sign-in."}
    >
      {reconnect ? `Reconnect ${provider.name}` : `Sign in with ${provider.name}`}
    </Button>
  );
}

function PasteTokenSlot({
  provider,
  autoFocus,
  defaultOpen,
  compact = false,
  triggerLabel = "Or paste a token",
}: {
  provider: ProviderConnectionState;
  autoFocus?: boolean;
  defaultOpen?: boolean;
  compact?: boolean;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <div className={cn(compact && !open ? "contents" : "space-y-2", compact && open && "basis-full pt-1")}>
      {open ? (
        <>
          <ProviderTokenForm provider={provider} autoFocus={autoFocus} />
          <div className={cn("flex items-center gap-2", compact && "justify-end")}>
            <TokenPageButton provider={provider} />
            {provider.oauthAvailable ? (
              <Button variant="ghost" size="sm" className="text-muted" onClick={() => setOpen(false)}>
                Hide token field
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <Button variant="ghost" size="sm" className="text-muted" onClick={() => setOpen(true)}>
          {triggerLabel}
        </Button>
      )}
    </div>
  );
}

export function providerLampState(provider: ProviderConnectionState): LampState {
  if (provider.connected) return "live";
  if (provider.connecting || provider.oauthConnecting) return "verifying";
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
        "relative overflow-hidden rounded-panel bg-surface px-4 py-3.5",
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
          <p className="text-body font-semibold text-ink">{provider.name}</p>
          <p className="truncate text-dense text-muted">
            {connected
              ? (provider.account ?? "Connected")
              : provider.oauthAvailable
                ? "Sign in with OAuth"
                : "Personal access token"}
          </p>
        </div>
        <LampReadout state={lamp} />
        {connected ? <DisconnectButton provider={provider} /> : null}
      </div>

      {!connected ? (
        <div data-slot className="relative overflow-hidden">
          <div className="mt-3.5 space-y-2.5 rounded-lg bg-surface-sunken p-2.5 shadow-[inset_0_1px_3px_oklch(0_0_0/0.18)]">
            {provider.oauthAvailable ? <SignInButton provider={provider} /> : null}
            {!provider.oauthAvailable ? (
              <p className="text-dense text-muted">
                OAuth is not configured. Paste a token to connect this provider.
              </p>
            ) : null}
            {provider.error ? (
              <p role="alert" className="flex gap-1.5 text-dense text-failed-ink">
                <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                {provider.error}
              </p>
            ) : null}
            <PasteTokenSlot
              provider={provider}
              autoFocus={autoFocus && !provider.oauthAvailable}
              defaultOpen={!provider.oauthAvailable}
            />
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
  const credentialDetail =
    provider.authKind === "oauth"
      ? provider.grantedScopes.length
        ? `OAuth · ${provider.grantedScopes.length} scopes`
        : "OAuth · reconnect to sync scopes"
      : provider.authKind === "pat"
        ? "Personal access token"
        : undefined;
  const detail = provider.connected
    ? [provider.account ?? "Connected", credentialDetail].filter(Boolean).join(" · ")
    : provider.checking
      ? "Checking connection…"
      : provider.oauthAvailable
        ? "Sign in with the browser, or paste a token"
        : "No account connected";

  return (
    <SettingRow
      className="items-start"
      label={
        <span className="flex items-center gap-2">
          <ProviderGlyph
            brand={provider.id}
            className={cn("size-3.5", provider.id === "cloudflare" ? "text-ember-ink" : "text-ink")}
          />
          <span>{provider.name}</span>
          <ConnectionStatusPill connected={provider.connected} checking={provider.checking} />
        </span>
      }
      description={detail}
    >
      <div className="flex w-[min(24rem,44vw)] flex-wrap items-center justify-end gap-1.5">
        {provider.oauthAvailable ? <SignInButton provider={provider} reconnect={provider.connected} compact /> : null}
        {!provider.oauthAvailable && !provider.connected ? (
          <p className="basis-full text-right text-dense text-muted">
            OAuth is not configured. Paste a token to connect this provider.
          </p>
        ) : null}
        {provider.error ? (
          <p role="alert" className="flex basis-full justify-end gap-1.5 text-dense text-failed-ink">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            {provider.error}
          </p>
        ) : null}
        <PasteTokenSlot
          provider={provider}
          defaultOpen={!provider.oauthAvailable && !provider.connected}
          compact
          triggerLabel="Use token"
        />
        {provider.connected ? <DisconnectButton provider={provider} /> : null}
      </div>
    </SettingRow>
  );
}
