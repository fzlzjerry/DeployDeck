import { safeStorage } from "electron";
import {
  applyRefreshedTokens,
  isExpired,
  needsRefresh,
  parseStoredCredential,
  serializeStoredCredential,
  type OAuthProvider,
  type StoredCredential,
} from "@shared/oauth";
import { isTerminalRefreshError, refreshOAuthTokens } from "./oauth/tokens";
import { getStore } from "./store";
import { sendToRenderer } from "./window";

export type CredentialProvider = OAuthProvider;

interface RefreshOperation {
  controller: AbortController;
  promise: Promise<string | null>;
  revision: number;
}

const refreshOperations = new Map<CredentialProvider, RefreshOperation>();
const credentialRevisions = new Map<CredentialProvider, number>();

function blobKey(provider: CredentialProvider): "vercelToken" | "cloudflareToken" {
  return provider === "vercel" ? "vercelToken" : "cloudflareToken";
}

async function encryptAndStore(provider: CredentialProvider, plaintext: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("macOS keychain encryption is unavailable, so DeployDeck cannot store this token.");
  }
  const encrypted = safeStorage.encryptString(plaintext);
  const store = await getStore();
  store.set(blobKey(provider), encrypted.toString("base64"));
  invalidatePendingRefresh(provider);
}

async function decryptBlob(provider: CredentialProvider): Promise<string | null> {
  const store = await getStore();
  const blob = store.get(blobKey(provider));
  if (!blob) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(blob, "base64"));
  } catch {
    store.delete(blobKey(provider));
    invalidatePendingRefresh(provider);
    return null;
  }
}

export async function saveCredential(provider: CredentialProvider, credential: StoredCredential): Promise<void> {
  if (!credential.accessToken.trim()) {
    throw new Error("Enter an API token before connecting.");
  }
  invalidatePendingRefresh(provider);
  await encryptAndStore(provider, serializeStoredCredential(credential));
}

export async function saveToken(provider: CredentialProvider, token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Enter an API token before connecting.");
  }
  await saveCredential(provider, { kind: "pat", accessToken: trimmed });
}

export async function readCredential(provider: CredentialProvider): Promise<StoredCredential | null> {
  const raw = await decryptBlob(provider);
  if (!raw) return null;
  try {
    return parseStoredCredential(raw);
  } catch {
    const store = await getStore();
    store.delete(blobKey(provider));
    invalidatePendingRefresh(provider);
    return null;
  }
}

export async function readToken(provider: CredentialProvider): Promise<string | null> {
  const credential = await readCredential(provider);
  if (!credential) return null;
  if (isExpired(credential) && !credential.refreshToken) {
    await clearToken(provider);
    sendToRenderer("host:connection-changed");
    return null;
  }
  if (!needsRefresh(credential)) return credential.accessToken;

  const inflight = refreshOperations.get(provider);
  if (inflight) return inflight.promise;

  const controller = new AbortController();
  const operation: RefreshOperation = {
    controller,
    revision: currentRevision(provider),
    promise: Promise.resolve(null),
  };
  operation.promise = refreshStoredCredential(
    provider,
    credential,
    operation.revision,
    controller.signal,
  ).finally(() => {
    if (refreshOperations.get(provider) === operation) refreshOperations.delete(provider);
  });
  refreshOperations.set(provider, operation);
  return operation.promise;
}

export async function hasToken(provider: CredentialProvider): Promise<boolean> {
  return Boolean(await readCredential(provider));
}

export async function clearToken(provider: CredentialProvider): Promise<void> {
  invalidatePendingRefresh(provider);
  const store = await getStore();
  store.delete(blobKey(provider));
  invalidatePendingRefresh(provider);
}

async function refreshStoredCredential(
  provider: CredentialProvider,
  credential: StoredCredential,
  revision: number,
  signal: AbortSignal,
): Promise<string | null> {
  if (!credential.refreshToken) return credential.accessToken;
  try {
    const tokens = await refreshOAuthTokens(provider, credential.refreshToken, signal);
    const next = applyRefreshedTokens(credential, tokens);
    const accessToken = await storeRefreshedCredential(provider, next, revision);
    if (accessToken) sendToRenderer("host:connection-changed");
    return accessToken;
  } catch (error) {
    if (signal.aborted || currentRevision(provider) !== revision) return null;
    if (isTerminalRefreshError(error)) {
      const cleared = await clearTokenAtRevision(provider, revision);
      if (cleared) sendToRenderer("host:connection-changed");
      return null;
    }
    throw error;
  }
}

async function storeRefreshedCredential(
  provider: CredentialProvider,
  credential: StoredCredential,
  revision: number,
): Promise<string | null> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("macOS keychain encryption is unavailable, so DeployDeck cannot store this token.");
  }
  const encrypted = safeStorage.encryptString(serializeStoredCredential(credential)).toString("base64");
  const store = await getStore();
  // No await is allowed between this check and set: disconnect/reconnect must
  // win over a refresh that started with an older rotating token.
  if (currentRevision(provider) !== revision) return null;
  store.set(blobKey(provider), encrypted);
  credentialRevisions.set(provider, revision + 1);
  return credential.accessToken;
}

async function clearTokenAtRevision(provider: CredentialProvider, revision: number): Promise<boolean> {
  const store = await getStore();
  if (currentRevision(provider) !== revision) return false;
  credentialRevisions.set(provider, revision + 1);
  store.delete(blobKey(provider));
  return true;
}

function currentRevision(provider: CredentialProvider): number {
  return credentialRevisions.get(provider) ?? 0;
}

function invalidatePendingRefresh(provider: CredentialProvider): void {
  credentialRevisions.set(provider, currentRevision(provider) + 1);
  refreshOperations.get(provider)?.controller.abort("credential-changed");
}
