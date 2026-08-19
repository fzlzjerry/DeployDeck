import { useEffect, useRef, useState } from "react";
import type { DeploymentLogEntry } from "@shared/models";
import { LogViewer } from "@/components/logs/log-viewer";

export function WorkerTailPanel({ accountId, scriptName }: { accountId: string; scriptName: string }) {
  const [entries, setEntries] = useState<DeploymentLogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let sessionId: string | undefined;
    let active = true;
    void window.deployDeck.cloudflare.startWorkerTail(accountId, scriptName).then((session) => {
      if (!active) {
        void window.deployDeck.cloudflare.stopWorkerTail(session.sessionId);
        return;
      }
      sessionId = session.sessionId;
    });
    const off = window.deployDeck.on<{ sessionId: string; entry: DeploymentLogEntry }>("host:worker-tail", (payload) => {
      if (!active || pausedRef.current) return;
      if (sessionId && payload.sessionId !== sessionId) return;
      setEntries((current) => [...current, payload.entry]);
    });
    return () => {
      active = false;
      off();
      if (sessionId) void window.deployDeck.cloudflare.stopWorkerTail(sessionId);
    };
  }, [accountId, scriptName]);

  return (
    <LogViewer
      entries={entries}
      live
      paused={paused}
      onPause={setPaused}
      onClear={() => setEntries([])}
    />
  );
}
