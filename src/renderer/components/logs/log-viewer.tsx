import { Copy, Pause, Play, ScrollText, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { DeploymentLogEntry, LogLevel } from "@shared/models";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { Button, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { copyText, formatWhen } from "@/lib/format";

export interface LogViewerProps {
  entries: DeploymentLogEntry[];
  loading?: boolean;
  error?: string;
  /** Non-empty when the provider cannot return runtime logs for this deployment. */
  unavailable?: string;
  /** Renders live-tail controls (pause/resume, clear) and follows new lines. */
  live?: boolean;
  paused?: boolean;
  onRetry?: () => void;
  onPause?: (paused: boolean) => void;
  onClear?: () => void;
}

const LEVEL_TONE: Record<LogLevel, string> = {
  fatal: "text-failed",
  error: "text-failed",
  warn: "text-warning",
  info: "text-ink",
  debug: "text-muted",
  trace: "text-muted",
  unknown: "text-muted",
};

function LevelTag({ level }: { level: LogLevel }) {
  return (
    <span className={cn("shrink-0 select-none font-medium uppercase", LEVEL_TONE[level])}>
      {level === "unknown" ? "log" : level}
    </span>
  );
}

export function LogViewer({
  entries,
  loading = false,
  error,
  unavailable,
  live = false,
  paused = false,
  onRetry,
  onPause,
  onClear,
}: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if ((live && !paused) || pinnedToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries, live, paused]);

  useEffect(() => {
    pinnedToBottom.current = true;
  }, [unavailable, error]);

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <ScreenError message={error} onRetry={onRetry} size="inline" />
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <EmptyState size="inline" icon={<ScrollText />} title="Runtime logs unavailable" body={unavailable} />
      </div>
    );
  }

  if (loading && entries.length === 0) {
    return (
      <div className="min-h-0 flex-1 space-y-1.5 p-3" role="status" aria-label="Loading logs">
        {Array.from({ length: 12 }).map((_, index) => (
          <Skeleton key={index} className={cn("h-3", index % 3 === 0 ? "w-2/3" : index % 3 === 1 ? "w-5/6" : "w-1/2")} />
        ))}
      </div>
    );
  }

  const hasControls = live || (entries.length > 0 && Boolean(onClear));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {hasControls ? (
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
          <span className="text-[11px] text-muted">
            {live ? (paused ? "Paused" : "Live") : `${entries.length} lines`}
            {live && entries.length > 0 ? ` · ${entries.length} lines` : ""}
          </span>
          <div className="flex items-center gap-1">
            {entries.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void copyText(entries.map((entry) => entry.message).join("\n"))}
              >
                <Copy aria-hidden />
                Copy
              </Button>
            ) : null}
            {live && onPause ? (
              <Button size="sm" variant="ghost" onClick={() => onPause(!paused)}>
                {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
                {paused ? "Resume" : "Pause"}
              </Button>
            ) : null}
            {onClear ? (
              <Button size="sm" variant="ghost" onClick={onClear} disabled={entries.length === 0}>
                <Trash2 aria-hidden />
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {entries.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            size="inline"
            icon={<ScrollText />}
            title={live ? "Waiting for output" : "No log output"}
            body={live ? "New lines appear here as the deployment emits them." : undefined}
          />
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-auto bg-surface/40 p-3 font-mono text-[12px] leading-5 select-text"
        >
          {entries.map((entry) => (
            <div key={entry.id} className="flex gap-3 whitespace-pre-wrap">
              {entry.timestamp ? (
                <span className="shrink-0 tabular-nums text-muted">{formatWhen(entry.timestamp, "absolute")}</span>
              ) : null}
              <LevelTag level={entry.level} />
              <span className="min-w-0 flex-1 break-words text-ink">{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
