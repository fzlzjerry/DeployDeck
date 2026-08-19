export interface AppError {
  provider?: "vercel" | "cloudflare";
  status?: number;
  code?: string;
  message: string;
  requestId?: string;
}

export class DeployDeckError extends Error implements AppError {
  provider?: "vercel" | "cloudflare";
  status?: number;
  code?: string;
  requestId?: string;

  constructor(error: AppError) {
    super(error.message);
    this.name = "DeployDeckError";
    this.provider = error.provider;
    this.status = error.status;
    this.code = error.code;
    this.requestId = error.requestId;
  }
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  );
}

export function toAppError(error: unknown, provider?: AppError["provider"]): AppError {
  if (error instanceof DeployDeckError) {
    return {
      provider: error.provider ?? provider,
      status: error.status,
      code: error.code,
      message: error.message,
      requestId: error.requestId,
    };
  }

  if (isAppError(error)) {
    return {
      provider: error.provider ?? provider,
      status: error.status,
      code: error.code,
      message: sanitizeErrorMessage(error.message),
      requestId: error.requestId,
    };
  }

  if (error instanceof Error) {
    return {
      provider,
      message: sanitizeErrorMessage(error.message),
    };
  }

  return {
    provider,
    message: "An unexpected error occurred.",
  };
}

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/Authorization:\s*[^\s]+/gi, "Authorization: [redacted]")
    .replace(/api[_-]?token["']?\s*[:=]\s*["']?[^"'\s]+/gi, "api_token=[redacted]")
    .replace(/access_token["']?\s*[:=]\s*["']?[^"'\s]+/gi, "access_token=[redacted]")
    .replace(/refresh_token["']?\s*[:=]\s*["']?[^"'\s]+/gi, "refresh_token=[redacted]")
    .replace(/[A-Za-z0-9_]{20,}\.[A-Za-z0-9._-]{10,}/g, "[redacted]");
}

export function friendlyProviderMessage(error: AppError): string {
  const status = error.status;
  const raw = error.message.toLowerCase();

  if (status === 401 || raw.includes("unauthorized") || raw.includes("not authenticated")) {
    return error.provider === "vercel"
      ? "Vercel rejected this session. Sign in again or paste a new token in Settings."
      : "Cloudflare rejected this session. Sign in again or paste a new token in Settings.";
  }

  if (status === 403 || raw.includes("forbidden") || raw.includes("permission") || raw.includes("not allowed")) {
    if (error.provider === "cloudflare" && (raw.includes("dns") || raw.includes("zone"))) {
      return "Cloudflare denied this action. Check that the token has DNS Write permission.";
    }
    if (raw.includes("runtime") || raw.includes("log")) {
      return "Vercel runtime logs are unavailable for this deployment or account plan.";
    }
    return error.provider === "cloudflare"
      ? "Cloudflare denied this action. Check that the token has the required permission."
      : "Vercel denied this action. Check that the token has the required permission.";
  }

  if (status === 404 || raw.includes("not found")) {
    return "The deployment no longer exists.";
  }

  if (status === 429 || raw.includes("rate limit") || raw.includes("too many")) {
    return "The provider rate limit was reached. Try again shortly.";
  }

  return sanitizeErrorMessage(error.message);
}
