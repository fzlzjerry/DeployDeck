import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, describe, it } from "node:test";
import { OAuthCancelledError, startAuthorizationCodeListener, type OAuthCallbackListener } from "./loopback";

const openListeners: OAuthCallbackListener[] = [];

afterEach(async () => {
  await Promise.all(openListeners.splice(0).map((listener) => listener.close()));
});

describe("OAuth loopback callback", () => {
  it("binds before returning and accepts a matching callback", async () => {
    const controller = new AbortController();
    const listener = await startAuthorizationCodeListener("expected-state", controller.signal, { port: 0 });
    openListeners.push(listener);

    const response = await callback(listener, "?code=authorization-code&state=expected-state");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Authorization received/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await listener.result, "authorization-code");
  });

  it("ignores stale callbacks with the wrong state", async () => {
    const controller = new AbortController();
    const listener = await startAuthorizationCodeListener("fresh-state", controller.signal, { port: 0 });
    openListeners.push(listener);

    const stale = await callback(listener, "?code=stale-code&state=old-state");
    assert.equal(stale.status, 400);

    const fresh = await callback(listener, "?code=fresh-code&state=fresh-state");
    assert.equal(fresh.status, 200);
    assert.equal(await listener.result, "fresh-code");
  });

  it("treats access_denied as cancellation only when state matches", async () => {
    const controller = new AbortController();
    const listener = await startAuthorizationCodeListener("expected-state", controller.signal, { port: 0 });
    openListeners.push(listener);

    const response = await callback(listener, "?error=access_denied&state=expected-state");
    assert.equal(response.status, 400);
    await assert.rejects(listener.result, OAuthCancelledError);
  });

  it("closes and rejects the pending callback when cancelled", async () => {
    const controller = new AbortController();
    const listener = await startAuthorizationCodeListener("expected-state", controller.signal, { port: 0 });
    openListeners.push(listener);

    controller.abort("cancel");
    await assert.rejects(listener.result, OAuthCancelledError);
  });

  it("reports a fixed-port collision before the browser is opened", async () => {
    const occupied = http.createServer();
    await new Promise<void>((resolve) => occupied.listen(0, "127.0.0.1", resolve));
    const address = occupied.address();
    assert.ok(address && typeof address === "object");

    try {
      await assert.rejects(
        startAuthorizationCodeListener("expected-state", new AbortController().signal, { port: address.port }),
        /could not listen on port/,
      );
    } finally {
      await new Promise<void>((resolve) => occupied.close(() => resolve()));
    }
  });
});

function callback(listener: OAuthCallbackListener, query: string): Promise<Response> {
  return fetch(`http://127.0.0.1:${listener.port}/oauth/callback${query}`);
}
