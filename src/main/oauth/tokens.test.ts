import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  OAuthTokenError,
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  isTerminalRefreshError,
  refreshOAuthTokens,
} from "./tokens";

const originalFetch = globalThis.fetch;
const originalVercelClientId = process.env.VERCEL_OAUTH_CLIENT_ID;
const originalCloudflareClientId = process.env.CLOUDFLARE_OAUTH_CLIENT_ID;

beforeEach(() => {
  process.env.VERCEL_OAUTH_CLIENT_ID = "vercel-client";
  process.env.CLOUDFLARE_OAUTH_CLIENT_ID = "cloudflare-client";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv("VERCEL_OAUTH_CLIENT_ID", originalVercelClientId);
  restoreEnv("CLOUDFLARE_OAUTH_CLIENT_ID", originalCloudflareClientId);
});

describe("buildAuthorizeUrl", () => {
  it("rejects the zero-permission Cloudflare request shown by the provider", () => {
    assert.throws(
      () => buildAuthorizeUrl("cloudflare", { challenge: "challenge", state: "state" }),
      /requires at least one explicit permission scope/,
    );
  });

  it("includes an explicit Cloudflare subset and Vercel identity scopes", () => {
    const cloudflare = new URL(
      buildAuthorizeUrl("cloudflare", {
        challenge: "challenge",
        state: "state",
        scopes: ["zone.read", "offline_access"],
      }),
    );
    assert.equal(cloudflare.searchParams.get("scope"), "zone.read offline_access");

    const vercel = new URL(buildAuthorizeUrl("vercel", { challenge: "challenge", state: "state" }));
    assert.equal(vercel.searchParams.get("scope"), "openid email profile offline_access");
  });
});

describe("OAuth token requests", () => {
  it("sends PKCE exchange fields and parses token metadata", async () => {
    let body: URLSearchParams | undefined;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      body = init?.body as URLSearchParams;
      return new Response(
        JSON.stringify({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: "3600",
          scope: "zone.read offline_access zone.read",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const tokens = await exchangeAuthorizationCode("cloudflare", { code: "code", verifier: "verifier" });
    assert.equal(body?.get("grant_type"), "authorization_code");
    assert.equal(body?.get("code_verifier"), "verifier");
    assert.equal(body?.get("client_id"), "cloudflare-client");
    assert.equal(tokens.expiresIn, 3600);
    assert.deepEqual(tokens.scopes, ["zone.read", "offline_access"]);
  });

  it("classifies invalid_grant as terminal without treating other failures that way", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "invalid_grant", error_description: "Refresh token expired" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    await assert.rejects(refreshOAuthTokens("vercel", "expired"), (error: unknown) => {
      assert.ok(error instanceof OAuthTokenError);
      assert.equal(error.errorCode, "invalid_grant");
      assert.equal(isTerminalRefreshError(error), true);
      return true;
    });
    assert.equal(isTerminalRefreshError(new Error("fetch failed")), false);
  });
});

function restoreEnv(key: "VERCEL_OAUTH_CLIENT_ID" | "CLOUDFLARE_OAUTH_CLIENT_ID", value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
