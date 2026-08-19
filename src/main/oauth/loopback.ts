import http from "node:http";
import {
  OAUTH_CALLBACK_PATH,
  OAUTH_LOOPBACK_HOST,
  OAUTH_LOOPBACK_PORT,
} from "@shared/oauth";

export class OAuthCancelledError extends Error {
  constructor(message = "Sign-in was cancelled.") {
    super(message);
    this.name = "OAuthCancelledError";
  }
}

export interface OAuthCallbackListener {
  /** Resolves only after a callback with the expected state is received. */
  result: Promise<string>;
  /** Stops listening and rejects a still-pending result. */
  close(reason?: Error): Promise<void>;
  port: number;
}

interface ListenerOptions {
  host?: string;
  port?: number;
  callbackPath?: string;
}

/**
 * Bind the loopback callback before opening the browser. Returning a separate
 * result promise removes the race where a fast provider redirect arrives before
 * Node has started listening.
 */
export async function startAuthorizationCodeListener(
  expectedState: string,
  signal: AbortSignal,
  options: ListenerOptions = {},
): Promise<OAuthCallbackListener> {
  if (!expectedState) throw new Error("OAuth state is missing.");

  const host = options.host ?? OAUTH_LOOPBACK_HOST;
  const requestedPort = options.port ?? OAUTH_LOOPBACK_PORT;
  const callbackPath = options.callbackPath ?? OAUTH_CALLBACK_PATH;
  let settled = false;
  let closing: Promise<void> | null = null;
  let resolveResult!: (code: string) => void;
  let rejectResult!: (error: Error) => void;

  const result = new Promise<string>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  // Cancellation can occur immediately after binding and before the caller
  // awaits `result`; keep Node from reporting that tiny gap as unhandled.
  void result.catch(() => undefined);

  const server = http.createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      writePage(response, 405, "Method not allowed", "Return to DeployDeck and try again.");
      return;
    }

    const address = server.address();
    const port = typeof address === "object" && address ? address.port : requestedPort;
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    if (url.pathname !== callbackPath) {
      writePage(response, 404, "Not found", "This local page only receives the DeployDeck sign-in callback.");
      return;
    }

    const state = url.searchParams.get("state");
    if (state !== expectedState) {
      writePage(response, 400, "Sign-in did not finish", "The callback did not match this DeployDeck session.");
      // A stale tab or unrelated local request must not terminate the real
      // session. Keep waiting for the callback that owns expectedState.
      return;
    }

    const providerError = url.searchParams.get("error");
    if (providerError) {
      const description = url.searchParams.get("error_description")?.trim() || providerError;
      writePage(response, 400, "Sign-in did not finish", "Return to DeployDeck to continue.");
      if (providerError === "access_denied" || providerError === "user_cancelled") {
        settle(new OAuthCancelledError());
      } else {
        settle(new Error(`Sign-in failed: ${description}`));
      }
      return;
    }

    const code = url.searchParams.get("code")?.trim();
    if (!code) {
      writePage(response, 400, "Sign-in did not finish", "The provider did not return an authorization code.");
      settle(new Error("The sign-in callback did not include an authorization code."));
      return;
    }

    writePage(
      response,
      200,
      "Authorization received",
      "Return to DeployDeck while it verifies the connection. You can close this tab.",
    );
    settle(null, code);
  });

  const closeServer = (): Promise<void> => {
    if (closing) return closing;
    if (!server.listening) return Promise.resolve();
    closing = new Promise((resolve) => {
      const forceClose = setTimeout(() => server.closeAllConnections?.(), 250);
      forceClose.unref();
      server.close(() => {
        clearTimeout(forceClose);
        resolve();
      });
      server.closeIdleConnections?.();
    });
    return closing;
  };

  const onAbort = () => settle(abortError(signal));

  function settle(error: Error | null, code?: string): void {
    if (settled) return;
    settled = true;
    signal.removeEventListener("abort", onAbort);
    if (error) rejectResult(error);
    else resolveResult(code as string);
    void closeServer();
  }

  if (signal.aborted) {
    throw abortError(signal);
  }

  try {
    await listen(server, requestedPort, host);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "EADDRINUSE") {
      throw new Error(
        `DeployDeck could not listen on port ${requestedPort}. Close the other app using that port and try again.`,
      );
    }
    throw error;
  }

  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  return {
    result,
    port,
    close: async (reason = new OAuthCancelledError()) => {
      settle(reason);
      await closeServer();
    },
  };
}

function abortError(signal: AbortSignal): Error {
  return signal.reason === "timeout"
    ? new Error("Sign-in timed out. Try again from DeployDeck.")
    : new OAuthCancelledError();
}

function listen(server: http.Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.removeListener("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function writePage(response: http.ServerResponse, status: number, title: string, body: string): void {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    Connection: "close",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    "Content-Type": "text/html; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} · DeployDeck</title>
    <style>
      body { font: 15px/1.45 -apple-system, BlinkMacSystemFont, sans-serif; margin: 48px auto; max-width: 28rem; padding: 0 20px; color: #1a1a1a; }
      h1 { font-size: 1.25rem; margin: 0 0 8px; }
      p { margin: 0; color: #444; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
  </body>
</html>`);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
