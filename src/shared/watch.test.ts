import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isWatched, parseWatchKey, watchKey } from "./watch";

describe("watchKey", () => {
  it("encodes Vercel projects without an account segment", () => {
    assert.equal(watchKey("vercel", "prj_123"), "vercel:prj_123");
  });

  it("encodes Cloudflare targets with the account id", () => {
    assert.equal(watchKey("cloudflare-pages", "docs", "acct"), "cloudflare-pages:acct:docs");
    assert.equal(watchKey("cloudflare-workers", "api", "acct"), "cloudflare-workers:acct:api");
  });
});

describe("parseWatchKey", () => {
  it("round-trips provider keys", () => {
    assert.deepEqual(parseWatchKey("vercel:prj_123"), { provider: "vercel", id: "prj_123" });
    assert.deepEqual(parseWatchKey("cloudflare-pages:acct:docs"), {
      provider: "cloudflare-pages",
      accountId: "acct",
      id: "docs",
    });
  });

  it("rejects unknown keys", () => {
    assert.equal(parseWatchKey("unknown:foo"), null);
  });
});

describe("isWatched", () => {
  it("matches the encoded key", () => {
    assert.equal(isWatched(["vercel:prj_123"], "vercel", "prj_123"), true);
    assert.equal(isWatched(["vercel:prj_123"], "vercel", "other"), false);
  });
});
