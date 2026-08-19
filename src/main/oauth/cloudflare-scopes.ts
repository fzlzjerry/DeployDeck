import { OAUTH_REDIRECT_URI } from "@shared/oauth";
import { createPkce } from "@shared/pkce";
import { buildAuthorizeUrl } from "./tokens";

export const CLOUDFLARE_BASELINE_SCOPES = [
  "account-settings.read",
  "workers-scripts.edit",
  "workers-routes.write",
  "workers-tail.read",
  "zone.read",
  "dns.write",
  "offline_access",
] as const;

export const CLOUDFLARE_SCOPE_CANDIDATES = [
  ...CLOUDFLARE_BASELINE_SCOPES,
  "workers-scripts.write",
  "workers-scripts.read",
  "workers-routes.edit",
  "workers-builds-config.edit",
  "workers-builds-config.write",
  "workers-builds.read",
  "dns.edit",
  "account.read",
  "pages.read",
  "pages.write",
  "pages.edit",
  "cloudflare-pages.read",
  "cloudflare-pages.write",
  "cloudflare-pages.edit",
] as const;

type ScopeProbe = "accepted" | "rejected" | "unknown";

interface ResolveCloudflareScopesInput {
  configuredScopes?: string[];
  savedScopes?: string[];
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

/**
 * Cloudflare does not infer registered client scopes when `scope` is omitted:
 * its consent screen shows zero permissions and authorization fails. Resolve a
 * non-empty explicit list before the browser is opened.
 */
export async function resolveCloudflareAuthorizeScopes({
  configuredScopes,
  savedScopes,
  signal,
  fetcher = fetch,
}: ResolveCloudflareScopesInput): Promise<string[]> {
  const configured = uniqueScopes(configuredScopes);
  if (configured.length) {
    const result = await probeScopeSet(configured, signal, fetcher);
    if (result === "rejected") {
      throw new Error(
        "CLOUDFLARE_OAUTH_SCOPES contains a scope that is not enabled on this Cloudflare OAuth client.",
      );
    }
    assertResourceScope(configured);
    return configured;
  }

  const saved = uniqueScopes(savedScopes);
  if (saved.length) {
    const result = await probeScopeSet(saved, signal, fetcher);
    if (result !== "rejected") {
      assertResourceScope(saved);
      return saved;
    }
  }

  const discovered = await probeCandidates([...CLOUDFLARE_SCOPE_CANDIDATES], signal, fetcher);
  if (hasResourceScope(discovered)) {
    console.info(`[oauth] Cloudflare scopes discovered: ${discovered.join(" ")}`);
    return discovered;
  }

  // A transient preflight failure must not regress to a zero-permission
  // request. The baseline matches DeployDeck's core Workers and DNS surfaces;
  // Cloudflare will return a precise invalid_scope callback if the client owner
  // configured a different set.
  const baseline = [...CLOUDFLARE_BASELINE_SCOPES];
  const baselineResult = await probeScopeSet(baseline, signal, fetcher);
  if (baselineResult === "rejected") {
    throw new Error(
      "Cloudflare OAuth has no usable DeployDeck scopes. Enable the required scopes on the client or set CLOUDFLARE_OAUTH_SCOPES to its exact scope ids.",
    );
  }
  return baseline;
}

async function probeCandidates(
  candidates: string[],
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<string[]> {
  const accepted: string[] = [];
  for (let index = 0; index < candidates.length; index += 4) {
    if (signal?.aborted) throw abortReason(signal);
    const batch = candidates.slice(index, index + 4);
    const results = await Promise.all(
      batch.map(async (scope) => ({ scope, result: await probeScopeSet([scope], signal, fetcher) })),
    );
    for (const { scope, result } of results) {
      if (result === "accepted") accepted.push(scope);
    }
  }
  return accepted;
}

async function probeScopeSet(
  scopes: string[],
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<ScopeProbe> {
  const pkce = createPkce();
  const url = new URL(
    buildAuthorizeUrl("cloudflare", {
      challenge: pkce.challenge,
      state: pkce.state,
      scopes,
    }),
  );
  // prompt=none makes Cloudflare validate client + scopes without creating a
  // browser session or showing consent.
  url.searchParams.set("prompt", "none");
  const request = timeoutSignal(signal, 6_000);
  try {
    const response = await fetcher(url, {
      redirect: "manual",
      headers: { Accept: "text/html" },
      signal: request.signal,
    });
    const location = response.headers.get("location");
    if (location) return classifyLocation(location);

    const text = await response.text();
    if (/invalid_scope|not allowed to request scope/i.test(text)) return "rejected";
    if (response.ok) return "unknown";
    return "unknown";
  } catch {
    if (signal?.aborted) throw abortReason(signal);
    if (request.signal.aborted) return "unknown";
    return "unknown";
  } finally {
    request.dispose();
  }
}

function classifyLocation(location: string): ScopeProbe {
  const url = new URL(location, "https://dash.cloudflare.com");
  const error = url.searchParams.get("error");
  const description = url.searchParams.get("error_description") ?? "";
  if (error === "invalid_scope" || /not allowed to request scope/i.test(description)) return "rejected";
  if (url.href.startsWith(OAUTH_REDIRECT_URI) && error) return "accepted";
  if (/\/login|\/oauth2\//i.test(url.pathname)) return "accepted";
  return "unknown";
}

function uniqueScopes(scopes: string[] | undefined): string[] {
  return [...new Set((scopes ?? []).map((scope) => scope.trim()).filter(Boolean))];
}

function hasResourceScope(scopes: string[]): boolean {
  return scopes.some((scope) => !["openid", "offline", "offline_access"].includes(scope));
}

function assertResourceScope(scopes: string[]): void {
  if (!hasResourceScope(scopes)) {
    throw new Error("Cloudflare OAuth requires at least one resource permission scope.");
  }
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("Cloudflare OAuth scope discovery was cancelled.");
}

function timeoutSignal(parent: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  dispose(): void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const onAbort = () => controller.abort(parent?.reason);
  if (parent) {
    if (parent.aborted) onAbort();
    else parent.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}
