export const OAUTH_LOOPBACK_HOST = "127.0.0.1";
export const OAUTH_LOOPBACK_PORT = 17342;
export const OAUTH_CALLBACK_PATH = "/oauth/callback";
export const OAUTH_REDIRECT_URI = `http://${OAUTH_LOOPBACK_HOST}:${OAUTH_LOOPBACK_PORT}${OAUTH_CALLBACK_PATH}`;
export const OAUTH_TIMEOUT_MS = 3 * 60 * 1000;
export const OAUTH_NETWORK_TIMEOUT_MS = 15 * 1000;
export const OAUTH_REFRESH_SKEW_MS = 2 * 60 * 1000;

export const VERCEL_OAUTH_AUTHORIZE_URL = "https://vercel.com/oauth/authorize";
export const VERCEL_OAUTH_TOKEN_URL = "https://api.vercel.com/login/oauth/token";
export const VERCEL_OAUTH_REVOKE_URL = "https://api.vercel.com/login/oauth/token/revoke";
export const VERCEL_OAUTH_SCOPES = "openid email profile offline_access";

export const CLOUDFLARE_OAUTH_AUTHORIZE_URL = "https://dash.cloudflare.com/oauth2/auth";
export const CLOUDFLARE_OAUTH_TOKEN_URL = "https://dash.cloudflare.com/oauth2/token";
export const CLOUDFLARE_OAUTH_REVOKE_URL = "https://dash.cloudflare.com/oauth2/revoke";

export type OAuthProvider = "vercel" | "cloudflare";

export interface StoredCredential {
  kind: "oauth" | "pat";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes?: string[];
}

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scopes?: string[];
}

export interface CloudflareCapabilities {
  pages: boolean;
  pagesWrite: boolean;
  workers: boolean;
  workersWrite: boolean;
  workerBuilds: boolean;
  workerSchedules: boolean;
  zones: boolean;
  dns: boolean;
  dnsWrite: boolean;
  workerRoutes: boolean;
  workerTail: boolean;
}

const ALL_CLOUDFLARE_CAPABILITIES: CloudflareCapabilities = {
  pages: true,
  pagesWrite: true,
  workers: true,
  workersWrite: true,
  workerBuilds: true,
  workerSchedules: true,
  zones: true,
  dns: true,
  dnsWrite: true,
  workerRoutes: true,
  workerTail: true,
};

export function isStoredCredential(value: unknown): value is StoredCredential {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.kind !== "oauth" && record.kind !== "pat") return false;
  if (typeof record.accessToken !== "string" || record.accessToken.trim().length === 0) return false;
  if (record.refreshToken !== undefined && typeof record.refreshToken !== "string") return false;
  if (record.expiresAt !== undefined && (typeof record.expiresAt !== "number" || !Number.isFinite(record.expiresAt))) {
    return false;
  }
  if (
    record.scopes !== undefined &&
    (!Array.isArray(record.scopes) || record.scopes.some((scope) => typeof scope !== "string" || !scope.trim()))
  ) {
    return false;
  }
  return true;
}

/** Decrypt blobs that predate OAuth are a raw token string, not JSON. */
export function parseStoredCredential(raw: string): StoredCredential {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Enter an API token before connecting.");
  }
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isStoredCredential(parsed)) return parsed;
    } catch {
      // A token that happens to start with "{" still connects as a PAT.
    }
  }
  return { kind: "pat", accessToken: trimmed };
}

export function serializeStoredCredential(credential: StoredCredential): string {
  return JSON.stringify({
    kind: credential.kind,
    accessToken: credential.accessToken,
    ...(credential.refreshToken ? { refreshToken: credential.refreshToken } : {}),
    ...(credential.expiresAt !== undefined ? { expiresAt: credential.expiresAt } : {}),
    ...(credential.scopes?.length ? { scopes: [...new Set(credential.scopes)] } : {}),
  });
}

export function isExpired(credential: StoredCredential, now = Date.now()): boolean {
  return credential.kind === "oauth" && credential.expiresAt !== undefined && credential.expiresAt <= now;
}

export function needsRefresh(credential: StoredCredential, now = Date.now()): boolean {
  if (credential.kind !== "oauth" || !credential.refreshToken || credential.expiresAt === undefined) {
    return false;
  }
  return credential.expiresAt - OAUTH_REFRESH_SKEW_MS <= now;
}

export function tokensToCredential(tokens: OAuthTokenSet, now = Date.now()): StoredCredential {
  const expiresIn = tokens.expiresIn ?? 3600;
  return {
    kind: "oauth",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: now + expiresIn * 1000,
    scopes: tokens.scopes,
  };
}

export function applyRefreshedTokens(
  current: StoredCredential,
  tokens: OAuthTokenSet,
  now = Date.now(),
): StoredCredential {
  return tokensToCredential(
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? current.refreshToken,
      expiresIn: tokens.expiresIn,
      scopes: tokens.scopes ?? current.scopes,
    },
    now,
  );
}

/** Parse an optional OAuth scope override without sending malformed values. */
export function parseOAuthScopes(value: string | null | undefined): string[] | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const scopes = [...new Set(raw.split(/[,\s]+/).filter(Boolean))];
  const invalid = scopes.find((scope) => !/^[A-Za-z0-9._:-]+$/.test(scope));
  if (invalid) {
    throw new Error(`Invalid OAuth scope: ${invalid}`);
  }
  return scopes.length ? scopes : undefined;
}

/**
 * PATs do not expose their permissions. Pre-migration OAuth blobs came from the
 * old fixed scope set (Workers + Zone/DNS, but no reliable Pages id), so keep
 * those features live while suppressing the Pages requests that otherwise
 * produce a permanent 403 polling loop. A reconnect records the exact scopes.
 */
export function cloudflareCapabilities(credential: StoredCredential | null | undefined): CloudflareCapabilities {
  if (!credential) {
    return {
      pages: false,
      pagesWrite: false,
      workers: false,
      workersWrite: false,
      workerBuilds: false,
      workerSchedules: false,
      zones: false,
      dns: false,
      dnsWrite: false,
      workerRoutes: false,
      workerTail: false,
    };
  }
  if (credential.kind === "pat") return { ...ALL_CLOUDFLARE_CAPABILITIES };
  if (!credential.scopes?.length) {
    return {
      pages: false,
      pagesWrite: false,
      workers: true,
      workersWrite: true,
      workerBuilds: false,
      workerSchedules: true,
      zones: true,
      dns: true,
      dnsWrite: true,
      workerRoutes: true,
      workerTail: true,
    };
  }

  const scopes = credential.scopes.map((scope) => scope.toLowerCase());
  const hasPrefix = (...prefixes: string[]) => scopes.some((scope) => prefixes.some((prefix) => scope.startsWith(prefix)));
  const hasWrite = (...prefixes: string[]) =>
    scopes.some((scope) => prefixes.some((prefix) => scope.startsWith(prefix)) && /(write|edit|update|create)/.test(scope));
  return {
    pages: hasPrefix("pages.", "cloudflare-pages."),
    pagesWrite: hasWrite("pages.", "cloudflare-pages."),
    workers: hasPrefix("workers-scripts."),
    workersWrite: hasWrite("workers-scripts."),
    workerBuilds: hasPrefix("workers-builds.", "workers-builds-config."),
    workerSchedules: hasPrefix("workers-scripts.", "workers-cron."),
    zones: hasPrefix("zone."),
    dns: hasPrefix("dns."),
    dnsWrite: hasWrite("dns."),
    workerRoutes: hasPrefix("workers-routes."),
    workerTail: hasPrefix("workers-tail."),
  };
}

export function isOAuthCancelledMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("cancelled") || lower.includes("canceled");
}
