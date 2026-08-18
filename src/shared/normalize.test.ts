import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inferLogLevel, pagesEnvironment, pagesState, vercelEnvironment, vercelState } from "./status";

describe("vercelState", () => {
  it("maps known Vercel ready states", () => {
    assert.equal(vercelState("QUEUED"), "queued");
    assert.equal(vercelState("BUILDING"), "building");
    assert.equal(vercelState("READY"), "ready");
    assert.equal(vercelState("ERROR"), "failed");
    assert.equal(vercelState("CANCELED"), "canceled");
    assert.equal(vercelState("mystery"), "unknown");
  });
});

describe("pagesState", () => {
  it("maps Pages deployment stages", () => {
    assert.equal(pagesState("idle"), "queued");
    assert.equal(pagesState("active"), "building");
    assert.equal(pagesState("success"), "ready");
    assert.equal(pagesState("failure"), "failed");
    assert.equal(pagesState("canceled"), "canceled");
  });
});

describe("environments", () => {
  it("maps provider environment strings", () => {
    assert.equal(vercelEnvironment("production"), "production");
    assert.equal(vercelEnvironment("preview"), "preview");
    assert.equal(pagesEnvironment("production"), "production");
    assert.equal(pagesEnvironment("preview"), "preview");
  });
});

describe("inferLogLevel", () => {
  it("uses explicit levels and message heuristics", () => {
    assert.equal(inferLogLevel("ok", "error"), "error");
    assert.equal(inferLogLevel("Build failed"), "error");
    assert.equal(inferLogLevel("warning: cache miss"), "warn");
    assert.equal(inferLogLevel("cloned repository"), "info");
  });
});
