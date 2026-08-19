import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { challengeFromVerifier, createPkce } from "./pkce";

describe("createPkce", () => {
  it("returns an S256 challenge bound to the verifier", () => {
    const pkce = createPkce();
    assert.match(pkce.verifier, /^[A-Za-z0-9_-]+$/);
    assert.match(pkce.challenge, /^[A-Za-z0-9_-]+$/);
    assert.match(pkce.state, /^[A-Za-z0-9_-]+$/);
    assert.ok(pkce.verifier.length >= 43);
    assert.equal(pkce.challenge, challengeFromVerifier(pkce.verifier));
  });

  it("generates a unique verifier and state each time", () => {
    const first = createPkce();
    const second = createPkce();
    assert.notEqual(first.verifier, second.verifier);
    assert.notEqual(first.state, second.state);
    assert.notEqual(first.challenge, second.challenge);
  });
});
