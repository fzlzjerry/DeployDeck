import { LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { OperationProgress } from "@shared/models";
import { Button } from "@/components/ui/primitives";

export function OperationStatus() {
  const [operation, setOperation] = useState<OperationProgress>();
  useEffect(() => window.deployDeck.on<OperationProgress>("host:operation-progress", (next) => {
    setOperation(next);
    if (next.phase === "complete") window.setTimeout(() => setOperation((current) => current?.operationId === next.operationId ? undefined : current), 2400);
  }), []);
  if (!operation) return null;
  const active = !["complete", "failed", "canceled"].includes(operation.phase);
  const percent = Math.min(100, (operation.completed / Math.max(1, operation.total)) * 100);
  return (
    <div role="status" aria-live="polite" className="fixed right-4 bottom-4 z-[var(--z-toast)] w-80 rounded-panel bg-panel p-3 shadow-[var(--shadow-popover)]">
      <div className="flex items-start gap-2">
        {active ? <LoaderCircle className="mt-0.5 size-3.5 shrink-0 animate-spin text-ember-ink motion-reduce:animate-none" aria-hidden /> : null}
        <div className="min-w-0 flex-1"><p className="truncate text-dense font-medium text-ink">{operation.label}</p><p className="mt-0.5 text-label capitalize text-muted">{operation.phase}</p></div>
        {active ? <Button size="icon-sm" variant="ghost" aria-label="Cancel operation" onClick={() => void window.deployDeck.operations.cancel(operation.operationId)}><X aria-hidden /></Button> : <Button size="icon-sm" variant="ghost" aria-label="Dismiss operation" onClick={() => setOperation(undefined)}><X aria-hidden /></Button>}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-ember transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

