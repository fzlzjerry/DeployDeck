import { DeployDeckError, sanitizeErrorMessage, toAppError } from "@shared/errors";

interface LooseError {
  status?: number;
  statusCode?: number;
  code?: string;
  message?: string;
  body?: unknown;
  error?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  requestID?: string;
}

function readString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  return undefined;
}

function extractMessage(error: LooseError): string {
  const body = error.body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const nestedError = record.error;
    if (nestedError && typeof nestedError === "object") {
      const message = readString((nestedError as { message?: unknown }).message);
      if (message) return message;
    }
    const errors = record.errors;
    if (Array.isArray(errors) && errors[0] && typeof errors[0] === "object") {
      const message = readString((errors[0] as { message?: unknown }).message);
      if (message) return message;
    }
    const message = readString(record.message);
    if (message) return message;
  }
  if (error.error && typeof error.error === "object") {
    const message = readString((error.error as { message?: unknown }).message);
    if (message) return message;
  }
  return sanitizeErrorMessage(error.message ?? "The provider request failed.");
}

export function throwProviderError(error: unknown, provider: "vercel" | "cloudflare"): never {
  if (error instanceof DeployDeckError) {
    throw error;
  }
  const loose = (error ?? {}) as LooseError;
  throw new DeployDeckError({
    provider,
    status: loose.statusCode ?? loose.status,
    code: loose.code,
    message: extractMessage(loose),
    requestId:
      loose.requestID ??
      readString(loose.headers?.["x-vercel-id"]) ??
      readString(loose.headers?.["cf-ray"]),
  });
}

export function wrapProvider<T>(provider: "vercel" | "cloudflare", fn: () => Promise<T>): Promise<T> {
  return fn().catch((error: unknown) => throwProviderError(error, provider));
}

export { toAppError };
