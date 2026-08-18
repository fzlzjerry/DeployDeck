import type { DeploymentEnvironment, DeploymentState, LogLevel } from "./models";

export function vercelState(readyState: string | undefined): DeploymentState {
  switch ((readyState ?? "").toUpperCase()) {
    case "QUEUED":
    case "INITIALIZING":
    case "PENDING":
      return "queued";
    case "BUILDING":
    case "DEPLOYING":
      return "building";
    case "READY":
    case "SUCCESS":
      return "ready";
    case "ERROR":
    case "FAILED":
      return "failed";
    case "CANCELED":
    case "CANCELLED":
      return "canceled";
    default:
      return "unknown";
  }
}

export function vercelEnvironment(target: string | undefined | null): DeploymentEnvironment {
  switch ((target ?? "").toLowerCase()) {
    case "production":
      return "production";
    case "preview":
      return "preview";
    case "development":
      return "development";
    default:
      return target ? "preview" : "unknown";
  }
}

export function pagesState(status: string | undefined): DeploymentState {
  switch ((status ?? "").toLowerCase()) {
    case "idle":
    case "queued":
    case "pending":
      return "queued";
    case "active":
    case "building":
    case "deploying":
    case "initializing":
      return "building";
    case "success":
    case "ready":
      return "ready";
    case "failure":
    case "failed":
    case "error":
      return "failed";
    case "canceled":
    case "cancelled":
      return "canceled";
    default:
      return "unknown";
  }
}

export function pagesEnvironment(environment: string | undefined): DeploymentEnvironment {
  switch ((environment ?? "").toLowerCase()) {
    case "production":
      return "production";
    case "preview":
      return "preview";
    default:
      return "unknown";
  }
}

export function inferLogLevel(message: string, explicit?: string): LogLevel {
  const value = (explicit ?? "").toLowerCase();
  if (value === "trace" || value === "debug" || value === "info" || value === "warn" || value === "error" || value === "fatal") {
    return value;
  }
  const text = message.toLowerCase();
  if (/\b(fatal|panic)\b/.test(text)) return "fatal";
  if (/\b(error|exception|failed)\b/.test(text)) return "error";
  if (value === "warning" || /\b(warn|warning)\b/.test(text)) return "warn";
  return "info";
}
