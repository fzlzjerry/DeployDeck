import { randomUUID } from "node:crypto";
import type { OperationProgress } from "@shared/models";
import { sendToRenderer } from "./window";

interface OperationState {
  controller: AbortController;
  progress: OperationProgress;
}

const operations = new Map<string, OperationState>();

export function beginOperation(label: string, total = 1): { operationId: string; signal: AbortSignal } {
  const operationId = randomUUID();
  const controller = new AbortController();
  const progress: OperationProgress = {
    operationId,
    phase: "preparing",
    label,
    completed: 0,
    total: Math.max(1, total),
  };
  operations.set(operationId, { controller, progress });
  sendToRenderer("host:operation-progress", progress);
  return { operationId, signal: controller.signal };
}

export function updateOperation(
  operationId: string,
  patch: Partial<Omit<OperationProgress, "operationId">>,
): OperationProgress | undefined {
  const state = operations.get(operationId);
  if (!state) return undefined;
  state.progress = { ...state.progress, ...patch, operationId };
  sendToRenderer("host:operation-progress", state.progress);
  return state.progress;
}

export function completeOperation(operationId: string, label?: string): void {
  const state = operations.get(operationId);
  if (!state) return;
  updateOperation(operationId, {
    phase: "complete",
    label: label ?? state.progress.label,
    completed: state.progress.total,
  });
  setTimeout(() => operations.delete(operationId), 30_000).unref();
}

export function failOperation(operationId: string, message: string): void {
  if (!operations.has(operationId)) return;
  updateOperation(operationId, { phase: "failed", label: message });
  setTimeout(() => operations.delete(operationId), 30_000).unref();
}

export function cancelOperation(operationId: string): void {
  const state = operations.get(operationId);
  if (!state) return;
  state.controller.abort(new Error("Operation canceled."));
  updateOperation(operationId, { phase: "canceled", label: "Canceled" });
  setTimeout(() => operations.delete(operationId), 30_000).unref();
}

export function assertOperationActive(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error("Operation canceled.");
  }
}

