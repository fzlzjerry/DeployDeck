import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyRefreshedTokens,
  cloudflareCapabilities,
  isExpired,
  isOAuthCancelledMessage,
  isStoredCredential,
  needsRefresh,
  parseStoredCredential,
  parseOAuthScopes,
  serializeStoredCredential,
  tokensToCredential,
} from "./oauth";

describe("parseStoredCredential", () => {
  it("treats a raw token string as a personal access token", () => {
    const credential = parseStoredCredential(" vercel_legacy_token ");
    assert.deepEqual(credential, { kind: "pat", accessToken: "vercel_legacy_token" });
  });

  it("reads an OAuth JSON blob", () => {
    const credential = parseStoredCredential(
      JSON.stringify({
        kind: "oauth",
        accessToken: "vca_access",
        refreshToken: "vcr_refresh",
        expiresAt: 1_700_000_000_000,
        scopes: ["openid", "offline_access"],
      }),
    );
    assert.equal(credential.kind, "oauth");
    assert.equal(credential.accessToken, "vca_access");
    assert.equal(credential.refreshToken, "vcr_refresh");
    assert.equal(credential.expiresAt, 1_700_000_000_000);
    assert.deepEqual(credential.scopes, ["openid", "offline_access"]);
  });

  it("falls back to a PAT when JSON is invalid or incomplete", () => {
    assert.deepEqual(parseStoredCredential('{"kind":"oauth"}'), {
      kind: "pat",
      accessToken: '{"kind":"oauth"}',
    });
    assert.equal(parseStoredCredential("{not-json").kind, "pat");
  });
});

describe("serializeStoredCredential", () => {
  it("round-trips an OAuth credential", () => {
    const original = {
      kind: "oauth" as const,
      accessToken: "vca_access",
      refreshToken: "vcr_refresh",
      expiresAt: 1_700_000_000_000,
      scopes: ["openid", "offline_access"],
    };
    const parsed = parseStoredCredential(serializeStoredCredential(original));
    assert.deepEqual(parsed, original);
  });
});

describe("needsRefresh", () => {
  const now = 1_000_000;

  it("is false for personal access tokens", () => {
    assert.equal(needsRefresh({ kind: "pat", accessToken: "tok" }, now), false);
  });

  it("is false when expiry is unknown or there is no refresh token", () => {
    assert.equal(needsRefresh({ kind: "oauth", accessToken: "tok", expiresAt: now + 60_000 }, now), false);
    assert.equal(
      needsRefresh({ kind: "oauth", accessToken: "tok", refreshToken: "ref" }, now),
      false,
    );
  });

  it("is true when the access token is inside the skew window", () => {
    assert.equal(
      needsRefresh(
        { kind: "oauth", accessToken: "tok", refreshToken: "ref", expiresAt: now + 60_000 },
        now,
      ),
      true,
    );
    assert.equal(
      needsRefresh(
        { kind: "oauth", accessToken: "tok", refreshToken: "ref", expiresAt: now + 10 * 60_000 },
        now,
      ),
      false,
    );
  });
});

describe("isExpired", () => {
  it("only expires OAuth credentials with a known deadline", () => {
    assert.equal(isExpired({ kind: "pat", accessToken: "tok", expiresAt: 1 }, 10), false);
    assert.equal(isExpired({ kind: "oauth", accessToken: "tok" }, 10), false);
    assert.equal(isExpired({ kind: "oauth", accessToken: "tok", expiresAt: 10 }, 10), true);
    assert.equal(isExpired({ kind: "oauth", accessToken: "tok", expiresAt: 11 }, 10), false);
  });
});

describe("applyRefreshedTokens", () => {
  it("writes the new access token and rotates the refresh token", () => {
    const next = applyRefreshedTokens(
      { kind: "oauth", accessToken: "old", refreshToken: "old_refresh", expiresAt: 1 },
      { accessToken: "new", refreshToken: "new_refresh", expiresIn: 3600 },
      10_000,
    );
    assert.equal(next.kind, "oauth");
    assert.equal(next.accessToken, "new");
    assert.equal(next.refreshToken, "new_refresh");
    assert.equal(next.expiresAt, 10_000 + 3600 * 1000);
  });

  it("keeps the previous refresh token when the provider omits a new one", () => {
    const next = applyRefreshedTokens(
      { kind: "oauth", accessToken: "old", refreshToken: "keep", expiresAt: 1 },
      { accessToken: "new", expiresIn: 120 },
      0,
    );
    assert.equal(next.refreshToken, "keep");
    assert.equal(next.expiresAt, 120_000);
  });

  it("preserves granted scopes unless the provider returns a replacement", () => {
    const current = {
      kind: "oauth" as const,
      accessToken: "old",
      refreshToken: "refresh",
      expiresAt: 1,
      scopes: ["zone.read", "offline_access"],
    };
    assert.deepEqual(applyRefreshedTokens(current, { accessToken: "new", expiresIn: 60 }, 0).scopes, current.scopes);
    assert.deepEqual(
      applyRefreshedTokens(current, { accessToken: "new", expiresIn: 60, scopes: ["dns.write"] }, 0).scopes,
      ["dns.write"],
    );
  });
});

describe("tokensToCredential", () => {
  it("defaults expiry to one hour when expires_in is missing", () => {
    const credential = tokensToCredential({ accessToken: "vca_x" }, 0);
    assert.equal(credential.expiresAt, 3600 * 1000);
    assert.equal(isStoredCredential(credential), true);
  });
});

describe("parseOAuthScopes", () => {
  it("normalizes comma/space separated overrides and removes duplicates", () => {
    assert.deepEqual(
      parseOAuthScopes(" zone.read, dns.write   zone.read offline_access "),
      ["zone.read", "dns.write", "offline_access"],
    );
  });

  it("leaves the authorize scope parameter unset when there is no override", () => {
    assert.equal(parseOAuthScopes(undefined), undefined);
    assert.equal(parseOAuthScopes("  "), undefined);
  });

  it("rejects malformed scope ids before opening the browser", () => {
    assert.throws(() => parseOAuthScopes("zone.read bad/scope"), /Invalid OAuth scope/);
  });
});

describe("cloudflareCapabilities", () => {
  it("keeps PATs optimistic and migrates legacy OAuth without Pages polling", () => {
    assert.equal(cloudflareCapabilities({ kind: "pat", accessToken: "token" }).pages, true);
    const legacy = cloudflareCapabilities({ kind: "oauth", accessToken: "token" });
    assert.equal(legacy.pages, false);
    assert.equal(legacy.workers, true);
  });

  it("maps saved OAuth scopes to provider features", () => {
    const capabilities = cloudflareCapabilities({
      kind: "oauth",
      accessToken: "token",
      scopes: ["account-settings.read", "workers-scripts.edit", "zone.read", "dns.write"],
    });
    assert.deepEqual(capabilities, {
      pages: false,
      workers: true,
      zones: true,
      dns: true,
      workerRoutes: false,
      workerTail: false,
    });
  });
});

describe("isOAuthCancelledMessage", () => {
  it("matches cancel copy from the loopback session", () => {
    assert.equal(isOAuthCancelledMessage("Sign-in was cancelled."), true);
    assert.equal(isOAuthCancelledMessage("The request was canceled by the user"), true);
    assert.equal(isOAuthCancelledMessage("Vercel rejected this session."), false);
  });
});
