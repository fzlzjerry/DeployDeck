import {
  CLOUDFLARE_OAUTH_AUTHORIZE_URL,
  CLOUDFLARE_OAUTH_REVOKE_URL,
  CLOUDFLARE_OAUTH_TOKEN_URL,
  OAUTH_NETWORK_TIMEOUT_MS,
  OAUTH_REDIRECT_URI,
  VERCEL_OAUTH_AUTHORIZE_URL,
  VERCEL_OAUTH_REVOKE_URL,
  VERCEL_OAUTH_SCOPES,
  VERCEL_OAUTH_TOKEN_URL,
  type OAuthProvider,
  type OAuthTokenSet,
  type StoredCredential,
} from "@shared/oauth";
import { getOAuthClientId } from "./config";

export class OAuthTokenError extends Error {
  constructor(
    message: string,
    readonly provider: OAuthProvider,
    readonly status: number,
    readonly errorCode?: string,
  ) {
    super(message);
    this.name = "OAuthTokenError";
  }
}

export function isTerminalRefreshError(error: unknown): boolean {
  // invalid_grant means the rotating refresh token expired, was revoked, or
  // was already consumed. Network/5xx/client-configuration errors must not
  // erase an otherwise recoverable local session.
  return error instanceof OAuthTokenError && error.errorCode === "invalid_grant";
}

export function buildAuthorizeUrl(
  provider: OAuthProvider,
  input: { challenge: string; state: string; scopes?: string[] },
): string {
  const clientId = requireClientId(provider);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: OAUTH_REDIRECT_URI,
    response_type: "code",
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
  });
  const scopes = provider === "vercel" ? VERCEL_OAUTH_SCOPES : input.scopes?.join(" ");
  if (provider === "cloudflare" && !scopes) {
    throw new Error("Cloudflare OAuth requires at least one explicit permission scope.");
  }
  if (scopes) params.set("scope", scopes);

  const base = provider === "vercel" ? VERCEL_OAUTH_AUTHORIZE_URL : CLOUDFLARE_OAUTH_AUTHORIZE_URL;
  return `${base}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(
  provider: OAuthProvider,
  input: { code: string; verifier: string },
  signal?: AbortSignal,
): Promise<OAuthTokenSet> {
  return requestTokens(
    provider,
    {
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: input.verifier,
      redirect_uri: OAUTH_REDIRECT_URI,
      client_id: requireClientId(provider),
    },
    signal,
  );
}

export async function refreshOAuthTokens(
  provider: OAuthProvider,
  refreshToken: string,
  signal?: AbortSignal,
): Promise<OAuthTokenSet> {
  return requestTokens(
    provider,
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: requireClientId(provider),
    },
    signal,
  );
}

export async function revokeOAuthCredential(
  provider: OAuthProvider,
  credential: StoredCredential,
): Promise<void> {
  const clientId = getOAuthClientId(provider);
  if (!clientId) return;
  const token = credential.refreshToken ?? credential.accessToken;
  if (!token) return;
  const url = provider === "vercel" ? VERCEL_OAUTH_REVOKE_URL : CLOUDFLARE_OAUTH_REVOKE_URL;
  const body = new URLSearchParams({
    token,
    client_id: clientId,
    token_type_hint: credential.refreshToken ? "refresh_token" : "access_token",
  });
  const request = requestTimeout(undefined, 3_000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      signal: request.signal,
    });
  } catch {
    // Revocation is best-effort. Local credentials are still cleared.
  } finally {
    request.dispose();
  }
}

function requireClientId(provider: OAuthProvider): string {
  const clientId = getOAuthClientId(provider);
  if (!clientId) {
    throw new Error(
      provider === "vercel"
        ? "Vercel OAuth is not configured. Set VERCEL_OAUTH_CLIENT_ID or paste a token."
        : "Cloudflare OAuth is not configured. Set CLOUDFLARE_OAUTH_CLIENT_ID or paste a token.",
    );
  }
  return clientId;
}

async function requestTokens(
  provider: OAuthProvider,
  body: Record<string, string>,
  parentSignal?: AbortSignal,
): Promise<OAuthTokenSet> {
  const url = provider === "vercel" ? VERCEL_OAUTH_TOKEN_URL : CLOUDFLARE_OAUTH_TOKEN_URL;
  const request = requestTimeout(parentSignal);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(body),
      signal: request.signal,
    });

    const payload = await readOAuthPayload(response);
    if (!response.ok) {
      const errorCode = asNonEmptyString(payload.error);
      throw new OAuthTokenError(
        oauthErrorMessage(provider, payload, response.status),
        provider,
        response.status,
        errorCode,
      );
    }

    const accessToken = asNonEmptyString(payload.access_token);
    if (!accessToken) {
      throw new OAuthTokenError(
        provider === "vercel"
          ? "Vercel did not return an access token."
          : "Cloudflare did not return an access token.",
        provider,
        response.status,
      );
    }
    return {
      accessToken,
      refreshToken: asNonEmptyString(payload.refresh_token),
      expiresIn: asPositiveNumber(payload.expires_in),
      scopes: asScopeList(payload.scope),
    };
  } catch (error) {
    if (error instanceof OAuthTokenError || parentSignal?.aborted) throw error;
    if (request.signal.aborted) {
      const name = provider === "vercel" ? "Vercel" : "Cloudflare";
      throw new Error(`${name} sign-in request timed out.`);
    }
    throw error;
  } finally {
    request.dispose();
  }
}

async function readOAuthPayload(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    const form = new URLSearchParams(text);
    if ([...form.keys()].length) return Object.fromEntries(form.entries());
    return {};
  }
}

function oauthErrorMessage(provider: OAuthProvider, payload: Record<string, unknown>, status: number): string {
  const description =
    asNonEmptyString(payload.error_description) ??
    asNonEmptyString(payload.message) ??
    asNonEmptyString(payload.error);
  const name = provider === "vercel" ? "Vercel" : "Cloudflare";
  if (description) return `${name} sign-in failed: ${cleanProviderText(description)}`;
  return `${name} sign-in failed (${status}).`;
}

function cleanProviderText(value: string): string {
  return [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .slice(0, 500);
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asPositiveNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function asScopeList(value: unknown): string[] | undefined {
  const scopes = Array.isArray(value)
    ? value.filter((scope): scope is string => typeof scope === "string")
    : typeof value === "string"
      ? value.split(/\s+/)
      : [];
  const normalized = [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))];
  return normalized.length ? normalized : undefined;
}

function requestTimeout(parentSignal?: AbortSignal, timeoutMs = OAUTH_NETWORK_TIMEOUT_MS): {
  signal: AbortSignal;
  dispose(): void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const onParentAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal) {
    if (parentSignal.aborted) onParentAbort();
    else parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", onParentAbort);
    },
  };
}
