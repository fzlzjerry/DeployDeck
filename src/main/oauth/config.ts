import { parseOAuthScopes, type OAuthProvider } from "@shared/oauth";

export function getOAuthClientId(provider: OAuthProvider): string {
  const value =
    provider === "vercel" ? process.env.VERCEL_OAUTH_CLIENT_ID : process.env.CLOUDFLARE_OAUTH_CLIENT_ID;
  return value?.trim() ?? "";
}

export function isOAuthConfigured(provider: OAuthProvider): boolean {
  return getOAuthClientId(provider).length > 0;
}

export function getCloudflareOAuthScopes(): string[] | undefined {
  // Cloudflare requires the authorization request to include an explicit scope
  // list. This optional value is authoritative when the client owner supplies
  // one; otherwise the session resolver reuses or discovers enabled scopes.
  return parseOAuthScopes(process.env.CLOUDFLARE_OAUTH_SCOPES);
}
