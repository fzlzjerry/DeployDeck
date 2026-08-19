import { useVirtualizer } from "@tanstack/react-virtual";
import { Download, Pause, Play, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DeploymentLogEntry, LogLevel } from "@shared/models";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { Button, Input, SelectControl, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/format";
import { toast } from "sonner";

const LEVEL_OPTIONS = [
  { value: "all", label: "All levels" },
  { value: "error", label: "Error" },
  { value: "warn", label: "Warn" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" },
];

export function LogViewer({
  entries,
  loading = false,
  error,
  unavailable,
  live = false,
  paused = false,
  fileName = "deployment.log",
  onRetry,
  onPause,
  onClear,
}: {
  entries: DeploymentLogEntry[];
  loading?: boolean;
  error?: string;
  unavailable?: string;
  live?: boolean;
  paused?: boolean;
  fileName?: string;
  onRetry?: () => void;
  onPause?: (paused: boolean) => void;
  onClear?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [follow, setFollow] = useState(true);
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (level !== "all" && !levelMatches(entry.level, level)) return false;
      if (!needle) return true;
      return [entry.message, entry.source, entry.stage].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [entries, level, query]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22,
    overscan: 24,
  });

  useEffect(() => {
    if (!follow || paused || filtered.length === 0) return;
    virtualizer.scrollToIndex(filtered.length - 1, { align: "end" });
  }, [filtered.length, follow, paused, virtualizer]);

  const exportLogs = async () => {
    const contents = (filtered.length > 0 ? filtered : entries)
      .map((entry) => {
        const stamp = entry.timestamp ?? "";
        const source = entry.source ? ` ${entry.source}` : "";
        return `${stamp} [${entry.level}]${source} ${entry.message}`.trim();
      })
      .join("\n");
    try {
      const saved = await window.deployDeck.files.saveText(fileName, contents || " ");
      if (saved) toast.success("Log saved");
    } catch (saveError) {
      toast.error(errorMessage(saveError));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter lines"
            aria-label="Filter log lines"
            className="pl-7"
          />
        </div>
        <SelectControl
          value={level}
          onValueChange={(value) => setLevel(value as LogLevel | "all")}
          options={LEVEL_OPTIONS}
          ariaLabel="Filter by log level"
          className="w-28"
          size="sm"
        />
        {live ? (
          <Button size="sm" variant="ghost" onClick={() => onPause?.(!paused)}>
            {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
            {paused ? "Resume" : "Pause"}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" aria-pressed={follow} onClick={() => setFollow((current) => !current)}>
            {follow ? "Following" : "Follow"}
          </Button>
        )}
        {onClear ? (
          <Button size="sm" variant="ghost" onClick={onClear}>
            <Trash2 aria-hidden />
            Clear
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => void exportLogs()} disabled={entries.length === 0}>
          <Download aria-hidden />
          Export
        </Button>
        <span className="ml-auto text-[11px] text-muted tabular">
          {filtered.length}
          {filtered.length !== entries.length ? ` / ${entries.length}` : ""}
        </span>
      </div>

      {unavailable ? (
        <EmptyState size="inline" title="Runtime logs unavailable" body={unavailable} />
      ) : error ? (
        <ScreenError size="inline" message={error} onRetry={onRetry} />
      ) : loading && entries.length === 0 ? (
        <div className="space-y-2 p-3" aria-label="Loading logs">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-4" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          size="inline"
          title={entries.length === 0 ? "No log lines yet" : "No lines match"}
          body={
            entries.length === 0
              ? live
                ? "Waiting for the next Worker event."
                : "Build output appears here once the provider emits events."
              : "Adjust the search or level filter."
          }
          action={
            onRetry && entries.length === 0
              ? { label: "Refresh", onClick: onRetry }
              : query || level !== "all"
                ? { label: "Reset filters", onClick: () => { setQuery(""); setLevel("all"); } }
                : undefined
          }
        />
      ) : (
        <div
          ref={parentRef}
          className="min-h-0 flex-1 overflow-auto bg-surface-sunken"
          onScroll={(event) => {
            if (!live && !follow) return;
            const node = event.currentTarget;
            const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 32;
            if (!nearBottom) setFollow(false);
          }}
        >
          <div className="relative w-full font-mono text-[11px] leading-[22px]" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const entry = filtered[item.index];
              return (
                <div
                  key={entry.id}
                  className="absolute right-0 left-0 flex gap-2 px-3 select-text"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <time className="w-16 shrink-0 text-subtle tabular" dateTime={entry.timestamp}>
                    {formatLogTime(entry.timestamp)}
                  </time>
                  <span className={cn("w-10 shrink-0 uppercase", levelClass(entry.level))}>{entry.level}</span>
                  <span className="min-w-0 whitespace-pre-wrap break-all text-ink">{entry.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {onRetry && entries.length > 0 ? (
        <div className="flex shrink-0 items-center justify-between border-t border-line px-3 py-1.5">
          <span className="text-[11px] text-muted">{live ? (paused ? "Paused" : "Live") : loading ? "Updating…" : "Snapshot"}</span>
          <Button size="sm" variant="ghost" className="text-muted" onClick={onRetry}>
            <RotateCcw aria-hidden />
            Refresh
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function levelMatches(actual: LogLevel, filter: LogLevel): boolean {
  if (filter === "error") return actual === "error" || actual === "fatal";
  if (filter === "warn") return actual === "warn";
  if (filter === "debug") return actual === "debug" || actual === "trace";
  return actual === filter;
}

function levelClass(level: LogLevel): string {
  if (level === "error" || level === "fatal") return "text-failed";
  if (level === "warn") return "text-warning";
  if (level === "debug" || level === "trace") return "text-subtle";
  return "text-muted";
}

function formatLogTime(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
