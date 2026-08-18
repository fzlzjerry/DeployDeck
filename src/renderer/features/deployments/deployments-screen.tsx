import * as ContextMenu from "@radix-ui/react-context-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { UnifiedDeployment } from "@shared/models";
import { ProviderMark, StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { LogViewer } from "@/components/logs/log-viewer";
import { InspectorHeader, InspectorPanel, ScreenToolbar } from "@/components/ui/layout";
import {
  Button,
  Input,
  SelectControl,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives";
import { useConnection, usePrefs } from "@/hooks/use-connection";
import { useUnifiedDeployments } from "@/hooks/use-data";
import { copyText, errorMessage, formatDuration, formatWhen, shortSha } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/ui-store";
import { toast } from "sonner";

export function DeploymentsScreen() {
  const filters = useUiStore((state) => state.filters);
  const setFilters = useUiStore((state) => state.setFilters);
  const selected = useUiStore((state) => state.selected);
  const inspectorOpen = useUiStore((state) => state.inspectorOpen);
  const closeInspector = useUiStore((state) => state.closeInspector);
  const searchNonce = useUiStore((state) => state.searchNonce);
  const connection = useConnection();
  const query = useUnifiedDeployments(filters);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState(filters.query ?? "");
  const activeFilterCount = [
    filters.provider && filters.provider !== "all",
    filters.state && filters.state !== "all",
    filters.environment && filters.environment !== "all",
    Boolean(filters.branch),
    Boolean(filters.query),
  ].filter(Boolean).length;

  useEffect(() => {
    searchRef.current?.focus();
  }, [searchNonce]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters({ query: search.trim() || undefined });
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [search, setFilters]);

  const resetFilters = () => {
    setSearch("");
    setFilters({
      provider: "all",
      accountId: "all",
      state: "all",
      environment: "all",
      branch: undefined,
      query: undefined,
    });
  };

  if (!connection.data?.vercel.connected && !connection.data?.cloudflare.connected) {
    return <EmptyState title="No provider connected" body="Add a Vercel or Cloudflare token in Settings." />;
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <ScreenToolbar>
          <div className="relative min-w-56 flex-1 max-w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              ref={searchRef}
              aria-label="Search deployments"
              placeholder="Search project, branch, URL, commit"
              className="pl-8"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <SelectControl
            value={filters.provider ?? "all"}
            onValueChange={(provider) => setFilters({ provider: provider as never })}
            ariaLabel="Filter by provider"
            className="w-36"
            options={[
              { value: "all", label: "All providers" },
              { value: "vercel", label: "Vercel" },
              { value: "cloudflare-pages", label: "Pages" },
              { value: "cloudflare-workers", label: "Workers" },
            ]}
          />
          <SelectControl
            value={filters.state ?? "all"}
            onValueChange={(state) => setFilters({ state: state as never })}
            ariaLabel="Filter by deployment state"
            className="w-32"
            options={[
              { value: "all", label: "All states" },
              { value: "queued", label: "Queued" },
              { value: "building", label: "Building" },
              { value: "ready", label: "Ready" },
              { value: "failed", label: "Failed" },
              { value: "canceled", label: "Canceled" },
            ]}
          />
          <SelectControl
            value={filters.environment ?? "all"}
            onValueChange={(environment) => setFilters({ environment: environment as never })}
            ariaLabel="Filter by environment"
            className="w-36"
            options={[
              { value: "all", label: "All environments" },
              { value: "production", label: "Production" },
              { value: "preview", label: "Preview" },
              { value: "development", label: "Development" },
            ]}
          />
          <Input
            aria-label="Filter by branch"
            placeholder="Branch"
            className="w-32"
            value={filters.branch ?? ""}
            onChange={(event) => setFilters({ branch: event.target.value || undefined })}
          />
          {activeFilterCount > 0 ? (
            <Button variant="ghost" size="sm" className="text-muted" onClick={resetFilters}>
              <RotateCcw aria-hidden />
              Reset {activeFilterCount}
            </Button>
          ) : null}
          {query.isFetching && !query.isLoading ? <span className="ml-auto text-[11px] text-muted">Updating…</span> : null}
        </ScreenToolbar>
        {query.isError ? (
          <ScreenError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-8" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No deployments match"
            body="Adjust the filters or reset them to return to the full deployment list."
            action={activeFilterCount > 0 ? { label: "Reset filters", onClick: resetFilters } : undefined}
          />
        ) : (
          <DeploymentTable items={items} />
        )}
        {query.hasNextPage ? (
          <div className="border-t border-line p-2">
            <Button variant="ghost" size="sm" onClick={() => void query.fetchNextPage()}>
              Load more
            </Button>
          </div>
        ) : null}
      </div>
      {inspectorOpen && selected ? (
        <InspectorPanel size="md" className="deployment-inspector">
          <InspectorHeader
            title={selected.projectName}
            subtitle={`${selected.environment} · ${selected.provider.replace("cloudflare-", "")}`}
            onClose={closeInspector}
          />
          <DeploymentDetail deployment={selected} />
        </InspectorPanel>
      ) : null}
    </div>
  );
}

function DeploymentTable({ items }: { items: UnifiedDeployment[] }) {
  const prefs = usePrefs();
  const openDeployment = useUiStore((state) => state.openDeployment);
  const selected = useUiStore((state) => state.selected);
  const [active, setActive] = useState(-1);
  const rows = useRef<Array<HTMLTableRowElement | null>>([]);

  const focusRow = (index: number) => {
    const next = Math.max(0, Math.min(items.length - 1, index));
    setActive(next);
    window.requestAnimationFrame(() => rows.current[next]?.focus());
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="data-table min-w-[1040px]" role="grid" aria-label="Deployments" aria-rowcount={items.length}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Provider</th>
            <th>Project</th>
            <th>Env</th>
            <th>Branch</th>
            <th>Commit</th>
            <th>Author</th>
            <th>Time</th>
            <th>Duration</th>
            <th>URL</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <ContextMenu.Root key={`${item.provider}:${item.id}`}>
              <ContextMenu.Trigger asChild>
                <tr
                  ref={(node) => {
                    rows.current[index] = node;
                  }}
                  tabIndex={active === index || (active === -1 && index === 0) ? 0 : -1}
                  aria-selected={selected?.id === item.id || undefined}
                  className={cn(
                    "cursor-default outline-none focus-visible:bg-surface-2",
                    selected?.id === item.id && "bg-ember-soft/55",
                  )}
                  onFocus={() => setActive(index)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      focusRow(index + 1);
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      focusRow(index - 1);
                    }
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDeployment(item);
                    }
                  }}
                  onClick={() => {
                    setActive(index);
                    openDeployment(item);
                  }}
                >
                  <td><StatusBadge state={item.state} /></td>
                  <td><ProviderMark provider={item.provider} showIcon={prefs.data?.showProviderIcons} /></td>
                  <td className="max-w-44 truncate font-medium">{item.projectName}</td>
                  <td className="capitalize">{item.environment}</td>
                  <td className="max-w-36 truncate">{item.branch ?? "—"}</td>
                  <td className="font-mono">{shortSha(item.commitSha, prefs.data?.fullCommitSha)}</td>
                  <td>{item.author ?? "—"}</td>
                  <td className="tabular">{formatWhen(item.createdAt, prefs.data?.timeFormat ?? "relative")}</td>
                  <td className="tabular">{formatDuration(item.durationMs)}</td>
                  <td className="max-w-40 truncate text-muted">{item.url ?? "—"}</td>
                </tr>
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Content className="z-50 min-w-44 rounded-md bg-bg p-1 shadow-[var(--shadow-popover)]">
                  <DeploymentActions deployment={item} />
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MenuItem({ children, onSelect }: { children: string; onSelect: () => void }) {
  return (
    <ContextMenu.Item
      className="cursor-default rounded px-2 py-1.5 text-[12px] outline-none data-[highlighted]:bg-surface-2"
      onSelect={onSelect}
    >
      {children}
    </ContextMenu.Item>
  );
}

export function DeploymentActions({ deployment }: { deployment: UnifiedDeployment }) {
  const ask = useUiStore((state) => state.askConfirm);
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: ["deployments"] });

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <>
      {deployment.url ? (
        <MenuItem onSelect={() => void window.deployDeck.shell.openHttps(deployment.url!)}>Open URL</MenuItem>
      ) : null}
      <MenuItem onSelect={() => void copyText(deployment.url ?? deployment.id)}>Copy URL</MenuItem>
      <MenuItem onSelect={() => void copyText(deployment.id)}>Copy ID</MenuItem>
      {deployment.commitSha ? (
        <MenuItem onSelect={() => void copyText(deployment.commitSha!)}>Copy commit</MenuItem>
      ) : null}
      {deployment.provider === "vercel" ? (
        <>
          {(deployment.state === "queued" || deployment.state === "building") && (
            <MenuItem onSelect={() => void run("Canceled", () => window.deployDeck.vercel.cancelDeployment(deployment.id))}>
              Cancel
            </MenuItem>
          )}
          <MenuItem onSelect={() => void run("Redeployed", () => window.deployDeck.vercel.redeploy(deployment.id))}>
            Redeploy
          </MenuItem>
          <MenuItem
            onSelect={() =>
              ask({
                title: "Promote to production",
                body: `${deployment.projectName} · ${deployment.id}`,
                actionLabel: "Promote",
                onConfirm: () => run("Promoted", () => window.deployDeck.vercel.promote(deployment.id, deployment.projectId)),
              })
            }
          >
            Promote
          </MenuItem>
          <MenuItem
            onSelect={() =>
              ask({
                title: "Delete deployment",
                body: `${deployment.projectName} · ${deployment.id}`,
                actionLabel: "Delete",
                onConfirm: () => run("Deleted", () => window.deployDeck.vercel.deleteDeployment(deployment.id)),
              })
            }
          >
            Delete
          </MenuItem>
        </>
      ) : null}
      {deployment.provider === "cloudflare-pages" ? (
        <>
          <MenuItem
            onSelect={() =>
              void run("Retry started", () =>
                window.deployDeck.cloudflare.retryPagesDeployment(deployment.accountId, deployment.projectName, deployment.id),
              )
            }
          >
            Retry
          </MenuItem>
          <MenuItem
            onSelect={() =>
              ask({
                title: "Roll back Pages deployment",
                body: `${deployment.projectName} · ${deployment.id}`,
                actionLabel: "Roll back",
                onConfirm: () =>
                  run("Rolled back", () =>
                    window.deployDeck.cloudflare.rollbackPagesDeployment(deployment.accountId, deployment.projectName, deployment.id),
                  ),
              })
            }
          >
            Roll back
          </MenuItem>
          <MenuItem
            onSelect={() =>
              ask({
                title: "Delete Pages deployment",
                body: `${deployment.projectName} · ${deployment.id}`,
                actionLabel: "Delete",
                onConfirm: () =>
                  run("Deleted", () =>
                    window.deployDeck.cloudflare.deletePagesDeployment(deployment.accountId, deployment.projectName, deployment.id),
                  ),
              })
            }
          >
            Delete
          </MenuItem>
        </>
      ) : null}
    </>
  );
}

export function DeploymentDetail({ deployment }: { deployment: UnifiedDeployment }) {
  const [tab, setTab] = useState<"overview" | "build" | "runtime" | "domains" | "raw">("overview");
  const prefs = usePrefs();
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: ["deployment", deployment.provider, deployment.id, deployment.projectId],
    queryFn: async () => {
      if (deployment.provider === "vercel") return window.deployDeck.vercel.getDeployment(deployment.id);
      if (deployment.provider === "cloudflare-pages") {
        return window.deployDeck.cloudflare.getPagesDeployment(deployment.accountId, deployment.projectName, deployment.id);
      }
      return deployment;
    },
  });
  const buildLogs = useQuery({
    queryKey: ["build-logs", deployment.provider, deployment.id],
    enabled: tab === "build",
    queryFn: async () => {
      if (deployment.provider === "vercel") return window.deployDeck.vercel.getBuildLogs(deployment.id);
      if (deployment.provider === "cloudflare-pages") {
        return window.deployDeck.cloudflare.getPagesLogs(deployment.accountId, deployment.projectName, deployment.id);
      }
      return [];
    },
  });
  const runtime = useQuery({
    queryKey: ["runtime-logs", deployment.provider, deployment.id],
    enabled: tab === "runtime" && deployment.provider === "vercel",
    queryFn: () => window.deployDeck.vercel.getRuntimeLogs(deployment.projectId, deployment.id),
  });
  const [tailEntries, setTailEntries] = useState<typeof buildLogs.data>([]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (tab !== "runtime" || deployment.provider !== "cloudflare-workers") return;
    let sessionId: string | undefined;
    let active = true;
    void window.deployDeck.cloudflare.startWorkerTail(deployment.accountId, deployment.projectName).then((session) => {
      sessionId = session.sessionId;
    });
    const off = window.deployDeck.on<{ sessionId: string; entry: NonNullable<typeof tailEntries>[number] }>(
      "host:worker-tail",
      (payload) => {
        if (!active || paused) return;
        setTailEntries((current) => [...(current ?? []), payload.entry]);
      },
    );
    return () => {
      active = false;
      off();
      if (sessionId) void window.deployDeck.cloudflare.stopWorkerTail(sessionId);
    };
  }, [deployment, paused, tab]);

  const current = detail.data ?? deployment;
  const runtimeUnavailable =
    runtime.data && !Array.isArray(runtime.data) ? runtime.data.unavailable : undefined;
  const runtimeEntries = Array.isArray(runtime.data) ? runtime.data : [];
  const runAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
      toast.success(label);
      await client.invalidateQueries({ queryKey: ["deployments"] });
      await detail.refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as typeof tab)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <TabsList aria-label="Deployment details">
        {(["overview", "build", "runtime", "domains", "raw"] as const).map((item) => (
          <TabsTrigger
            key={item}
            value={item}
          >
            {item === "runtime" ? (deployment.provider === "cloudflare-workers" ? "Live tail" : "Runtime") : item}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="overview" className="overflow-auto p-3 text-[12px]">
        <div className="space-y-2">
          <Row label="Status" value={<StatusBadge state={current.state} />} />
          <Row label="Environment" value={current.environment} />
          <Row label="Branch" value={current.branch ?? "—"} />
          <Row label="Commit" value={shortSha(current.commitSha, prefs.data?.fullCommitSha)} />
          <Row label="Message" value={current.commitMessage ?? "—"} />
          <Row label="Author" value={current.author ?? "—"} />
          <Row label="Created" value={formatWhen(current.createdAt, "absolute")} />
          <Row label="Duration" value={formatDuration(current.durationMs)} />
          <Row label="URL" value={current.url ?? "—"} />
          <div className="flex flex-wrap gap-2 pt-2">
            {current.url ? (
              <Button size="sm" onClick={() => void window.deployDeck.shell.openHttps(current.url!)}>
                Open
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => void copyText(current.id)}>
              Copy ID
            </Button>
            {current.provider === "vercel" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void runAction("Redeployment started", () => window.deployDeck.vercel.redeploy(current.id))}
              >
                Redeploy
              </Button>
            ) : null}
            {current.provider === "cloudflare-pages" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void runAction("Retry started", () =>
                    window.deployDeck.cloudflare.retryPagesDeployment(current.accountId, current.projectName, current.id),
                  )
                }
              >
                Retry
              </Button>
            ) : null}
          </div>
        </div>
      </TabsContent>
      <TabsContent value="build" className="flex min-h-0 flex-1 flex-col">
        <LogViewer
          entries={buildLogs.data ?? []}
          loading={buildLogs.isLoading}
          error={buildLogs.isError ? errorMessage(buildLogs.error) : undefined}
        />
      </TabsContent>
      <TabsContent value="runtime" className="flex min-h-0 flex-1 flex-col">
        {deployment.provider === "vercel" ? (
          <LogViewer
            entries={runtimeEntries}
            loading={runtime.isLoading}
            unavailable={runtimeUnavailable}
            error={runtime.isError ? errorMessage(runtime.error) : undefined}
          />
        ) : null}
        {deployment.provider === "cloudflare-workers" ? (
          <LogViewer entries={tailEntries ?? []} live paused={paused} onPause={setPaused} onClear={() => setTailEntries([])} />
        ) : null}
        {deployment.provider === "cloudflare-pages" ? (
          <EmptyState title="No runtime tail" body="Pages deployments expose build logs. Use the Build tab." />
        ) : null}
      </TabsContent>
      <TabsContent value="domains" className="overflow-auto p-3 text-[12px]">
        <div className="space-y-1 overflow-auto p-3 text-[12px]">
          {(current.aliases.length > 0 ? current.aliases : [current.url]).filter(Boolean).map((alias) => (
            <div key={alias} className="flex items-center justify-between rounded-md border border-line px-2 py-1.5">
              <span className="truncate">{alias}</span>
              <Button size="sm" variant="ghost" onClick={() => void window.deployDeck.shell.openHttps(alias!)}>
                Open
              </Button>
            </div>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="raw" className="flex min-h-0 flex-1 flex-col">
        <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] select-text">
          {JSON.stringify("metadata" in current ? (current as { metadata?: unknown }).metadata : current, null, 2)}
        </pre>
      </TabsContent>
    </Tabs>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
