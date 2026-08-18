import { safeStorage } from "electron";
import { getStore } from "./store";

export type CredentialProvider = "vercel" | "cloudflare";

function blobKey(provider: CredentialProvider): "vercelToken" | "cloudflareToken" {
  return provider === "vercel" ? "vercelToken" : "cloudflareToken";
}

export async function saveToken(provider: CredentialProvider, token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Enter an API token before connecting.");
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "macOS keychain encryption is unavailable, so DeployDeck cannot store this token.",
    );
  }
  const encrypted = safeStorage.encryptString(trimmed);
  const store = await getStore();
  store.set(blobKey(provider), encrypted.toString("base64"));
}

export async function readToken(provider: CredentialProvider): Promise<string | null> {
  const store = await getStore();
  const blob = store.get(blobKey(provider));
  if (!blob) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(blob, "base64"));
  } catch {
    store.delete(blobKey(provider));
    return null;
  }
}

export async function hasToken(provider: CredentialProvider): Promise<boolean> {
  const store = await getStore();
  return Boolean(store.get(blobKey(provider)));
}

export async function clearToken(provider: CredentialProvider): Promise<void> {
  const store = await getStore();
  store.delete(blobKey(provider));
}
