import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { OAUTH_REDIRECT_URI } from "@shared/oauth";
import {
  CLOUDFLARE_BASELINE_SCOPES,
  resolveCloudflareAuthorizeScopes,
} from "./cloudflare-scopes";

const originalClientId = process.env.CLOUDFLARE_OAUTH_CLIENT_ID;

beforeEach(() => {
  process.env.CLOUDFLARE_OAUTH_CLIENT_ID = "cloudflare-client";
});

afterEach(() => {
  if (originalClientId === undefined) delete process.env.CLOUDFLARE_OAUTH_CLIENT_ID;
  else process.env.CLOUDFLARE_OAUTH_CLIENT_ID = originalClientId;
});

describe("resolveCloudflareAuthorizeScopes", () => {
  it("uses an accepted explicit configuration and never emits zero permissions", async () => {
    let requested: string | null = null;
    const scopes = await resolveCloudflareAuthorizeScopes({
      configuredScopes: ["zone.read", "dns.write", "offline_access"],
      fetcher: (async (input: string | URL | Request) => {
        requested = new URL(String(input)).searchParams.get("scope");
        return accepted();
      }) as typeof fetch,
    });

    assert.deepEqual(scopes, ["zone.read", "dns.write", "offline_access"]);
    assert.equal(requested, "zone.read dns.write offline_access");
  });

  it("reuses scopes stored with an existing OAuth credential", async () => {
    const scopes = await resolveCloudflareAuthorizeScopes({
      savedScopes: ["workers-scripts.edit", "zone.read", "dns.write", "offline_access"],
      fetcher: (async () => accepted()) as typeof fetch,
    });
    assert.deepEqual(scopes, ["workers-scripts.edit", "zone.read", "dns.write", "offline_access"]);
  });

  it("discovers only candidate scopes enabled on the client", async () => {
    const allowed = new Set(["account-settings.read", "dns.write", "offline_access"]);
    const scopes = await resolveCloudflareAuthorizeScopes({
      fetcher: (async (input: string | URL | Request) => {
        const scope = new URL(String(input)).searchParams.get("scope") ?? "";
        return allowed.has(scope) ? accepted() : rejected(scope);
      }) as typeof fetch,
    });
    assert.deepEqual(scopes, ["account-settings.read", "dns.write", "offline_access"]);
  });

  it("fails before opening a zero-permission consent screen when no usable scope exists", async () => {
    await assert.rejects(
      resolveCloudflareAuthorizeScopes({
        fetcher: (async (input: string | URL | Request) => {
          const scope = new URL(String(input)).searchParams.get("scope") ?? "";
          return rejected(scope);
        }) as typeof fetch,
      }),
      /no usable DeployDeck scopes/,
    );
  });

  it("uses a non-empty baseline when preflight is temporarily unavailable", async () => {
    const scopes = await resolveCloudflareAuthorizeScopes({
      fetcher: (async () => {
        throw new Error("network unavailable");
      }) as typeof fetch,
    });
    assert.deepEqual(scopes, [...CLOUDFLARE_BASELINE_SCOPES]);
    assert.ok(scopes.length > 0);
  });
});

function accepted(): Response {
  const location = new URL(OAUTH_REDIRECT_URI);
  location.searchParams.set("error", "login_required");
  location.searchParams.set("error_description", "End-User authentication is required");
  return new Response(null, { status: 303, headers: { Location: location.toString() } });
}

function rejected(scope: string): Response {
  const location = new URL(OAUTH_REDIRECT_URI);
  location.searchParams.set("error", "invalid_scope");
  location.searchParams.set("error_description", `Client is not allowed to request scope '${scope}'`);
  return new Response(null, { status: 303, headers: { Location: location.toString() } });
}
