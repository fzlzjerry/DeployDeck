import { shell } from "electron";
import { OAUTH_TIMEOUT_MS, type OAuthProvider, type OAuthTokenSet } from "@shared/oauth";
import { createPkce } from "@shared/pkce";
import { readCredential } from "../credentials";
import { resolveCloudflareAuthorizeScopes } from "./cloudflare-scopes";
import { getCloudflareOAuthScopes, isOAuthConfigured } from "./config";
import {
  OAuthCancelledError,
  startAuthorizationCodeListener,
  type OAuthCallbackListener,
} from "./loopback";
import { buildAuthorizeUrl, exchangeAuthorizationCode } from "./tokens";

let active: AbortController | null = null;

export { OAuthCancelledError };

export async function startOAuthSession(provider: OAuthProvider): Promise<OAuthTokenSet> {
  if (!isOAuthConfigured(provider)) {
    throw new Error(
      provider === "vercel"
        ? "Vercel OAuth is not configured. Set VERCEL_OAUTH_CLIENT_ID or paste a token."
        : "Cloudflare OAuth is not configured. Set CLOUDFLARE_OAUTH_CLIENT_ID or paste a token.",
    );
  }

  cancelOAuthSession();
  const controller = new AbortController();
  active = controller;
  const timer = setTimeout(() => controller.abort("timeout"), OAUTH_TIMEOUT_MS);
  let listener: OAuthCallbackListener | null = null;

  try {
    const pkce = createPkce();
    const savedCredential = provider === "cloudflare" ? await readCredential("cloudflare") : null;
    const scopes =
      provider === "cloudflare"
        ? await resolveCloudflareAuthorizeScopes({
            configuredScopes: getCloudflareOAuthScopes(),
            savedScopes: savedCredential?.kind === "oauth" ? savedCredential.scopes : undefined,
            signal: controller.signal,
          })
        : undefined;
    const authorizeUrl = buildAuthorizeUrl(provider, {
      challenge: pkce.challenge,
      state: pkce.state,
      scopes,
    });
    listener = await startAuthorizationCodeListener(pkce.state, controller.signal);
    await shell.openExternal(authorizeUrl);
    const code = await listener.result;
    return await exchangeAuthorizationCode(provider, { code, verifier: pkce.verifier }, controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      if (controller.signal.reason === "timeout") {
        throw new Error("Sign-in timed out. Try again from DeployDeck.");
      }
      throw new OAuthCancelledError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
    await listener?.close();
    if (!controller.signal.aborted) controller.abort("complete");
    if (active === controller) active = null;
  }
}

export function cancelOAuthSession(): void {
  if (!active) return;
  active.abort("cancel");
  active = null;
}
