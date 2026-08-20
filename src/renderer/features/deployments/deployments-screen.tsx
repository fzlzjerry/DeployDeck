import * as ContextMenu from "@radix-ui/react-context-menu";
import * as Popover from "@radix-ui/react-popover";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { UnifiedDeployment } from "@shared/models";
import { ProviderMark, StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { LogViewer } from "@/components/logs/log-viewer";
import { WorkerTailPanel } from "@/components/logs/worker-tail";
import { DetailRow, InspectorHeader, InspectorPanel, ResourceListFrame, ScreenToolbar } from "@/components/ui/layout";
import { ContextMenuContent, ContextMenuItem as MenuItem } from "@/components/ui/menu";
import { Panel } from "@/components/ui/panel";
import {
  Badge,
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
import { useUiStore } from "@/stores/ui-store";
import { toast } from "sonner";

export function DeploymentsScreen() {
  const filters = useUiStore((state) => state.filters);
  const setFilters = useUiStore((state) => state.setFilters);
  const selected = useUiStore((state) => state.selected);
  const inspectorOpen = useUiStore((state) => state.inspectorOpen);
  const closeInspector = useUiStore((state) => state.closeInspector);
  const openCreate = useUiStore((state) => state.openCreate);
  const searchNonce = useUiStore((state) => state.searchNonce);
  const connection = useConnection();
  const query = useUnifiedDeployments(filters);
  const canVercel = Boolean(connection.data?.vercel.connected);
  const canPages = Boolean(
    connection.data?.cloudflare.connected && (connection.data.cloudflare.capabilities?.pages ?? true),
  );
  const canWorkers = Boolean(
    connection.data?.cloudflare.connected && (connection.data.cloudflare.capabilities?.workers ?? true),
  );
  const providerOptions = [
    { value: "all", label: "All providers" },
    ...(canVercel ? [{ value: "vercel", label: "Vercel" }] : []),
    ...(canPages ? [{ value: "cloudflare-pages", label: "Pages" }] : []),
    ...(canWorkers ? [{ value: "cloudflare-workers", label: "Workers" }] : []),
  ];
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

  useEffect(() => {
    const provider = filters.provider;
    if (
      (provider === "vercel" && !canVercel) ||
      (provider === "cloudflare-pages" && !canPages) ||
      (provider === "cloudflare-workers" && !canWorkers)
    ) {
      setFilters({ provider: "all" });
    }
  }, [canPages, canVercel, canWorkers, filters.provider, setFilters]);

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
        <ResourceListFrame>
        <Panel className="min-h-0 flex-1">
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
          <div className="contents max-[1479px]:hidden">
            <DeploymentFilterControls filters={filters} providerOptions={providerOptions} setFilters={setFilters} />
            {activeFilterCount > 0 ? <Button variant="ghost" size="sm" className="text-muted" onClick={resetFilters}><RotateCcw aria-hidden /> Reset {activeFilterCount}</Button> : null}
          </div>
          <Popover.Root>
            <Popover.Trigger asChild><Button size="sm" variant="outline" className="min-[1480px]:hidden"><SlidersHorizontal aria-hidden /> Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}</Button></Popover.Trigger>
            <Popover.Portal><Popover.Content align="start" sideOffset={6} collisionPadding={8} className="z-[var(--z-dropdown)] w-72 space-y-3 rounded-panel bg-panel p-3 shadow-[var(--shadow-popover)]">
              <DeploymentFilterControls filters={filters} providerOptions={providerOptions} setFilters={setFilters} stacked />
              {activeFilterCount > 0 ? <Button variant="ghost" size="sm" className="w-full justify-start text-muted" onClick={resetFilters}><RotateCcw aria-hidden /> Reset {activeFilterCount} filters</Button> : null}
            </Popover.Content></Popover.Portal>
          </Popover.Root>
          <div className="ml-auto flex shrink-0 items-center gap-3 text-dense text-muted">
            {query.isFetching && !query.isLoading ? <span>Updating…</span> : null}
            {query.isLoading ? null : (
              <span className="tabular">
                {items.length} {items.length === 1 ? "deployment" : "deployments"}
              </span>
            )}
            <Button size="sm" variant="accent" onClick={() => openCreate("deployment")}><Plus aria-hidden /> Deploy</Button>
          </div>
        </ScreenToolbar>
        {query.isError ? (
          <ScreenError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <DeploymentTableSkeleton />
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
          <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-t border-line bg-panel-header px-6 py-2">
            <span className="text-dense text-muted tabular">{items.length} loaded</span>
            <Button
              variant="outline"
              size="sm"
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Load more
            </Button>
          </div>
        ) : null}
        </Panel>
        </ResourceListFrame>
      </div>
      {inspectorOpen && selected ? (
        <InspectorPanel size="md" className="deployment-inspector" onDismiss={closeInspector} aria-label={`${selected.projectName} deployment inspector`}>
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

function DeploymentFilterControls({ filters, providerOptions, setFilters, stacked = false }: {
  filters: ReturnType<typeof useUiStore.getState>["filters"];
  providerOptions: Array<{ value: string; label: string }>;
  setFilters: (patch: Partial<ReturnType<typeof useUiStore.getState>["filters"]>) => void;
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? "grid gap-2" : "contents"}>
      <SelectControl value={filters.provider ?? "all"} onValueChange={(provider) => setFilters({ provider: provider as never })} ariaLabel="Filter by provider" className={stacked ? "w-full" : "w-36"} options={providerOptions} />
      <SelectControl value={filters.state ?? "all"} onValueChange={(state) => setFilters({ state: state as never })} ariaLabel="Filter by deployment state" className={stacked ? "w-full" : "w-32"} options={[{ value: "all", label: "All states" }, { value: "queued", label: "Queued" }, { value: "building", label: "Building" }, { value: "ready", label: "Ready" }, { value: "failed", label: "Failed" }, { value: "canceled", label: "Canceled" }]} />
      <SelectControl value={filters.environment ?? "all"} onValueChange={(environment) => setFilters({ environment: environment as never })} ariaLabel="Filter by environment" className={stacked ? "w-full" : "w-44"} options={[{ value: "all", label: "All environments" }, { value: "production", label: "Production" }, { value: "preview", label: "Preview" }, { value: "development", label: "Development" }]} />
      <Input aria-label="Filter by branch" placeholder="Branch" className={stacked ? "w-full" : "w-32"} value={filters.branch ?? ""} onChange={(event) => setFilters({ branch: event.target.value || undefined })} />
    </div>
  );
}

/**
 * One source of truth for the column rails, so the loading skeleton cannot
 * drift out of alignment with the real rows.
 *
 * The fixed table can compress to a 980px resource surface. Column widths are
 * relative rails rather than a reason to force the whole window wider.
 */
const COLUMNS = [
  { key: "status", label: "Status", width: 90 },
  { key: "provider", label: "Provider", width: 95 },
  { key: "project", label: "Project", width: 160 },
  { key: "env", label: "Env", width: 100 },
  { key: "branch", label: "Branch", width: 110 },
  { key: "commit", label: "Commit", width: 90 },
  { key: "author", label: "Author", width: 90 },
  { key: "time", label: "Time", width: 90, numeric: true },
  { key: "duration", label: "Duration", width: 70, numeric: true },
  { key: "url", label: "URL", width: 85 },
] as const;

const TABLE_MIN_WIDTH = 980;

function ColumnRails() {
  return (
    <colgroup>
      {COLUMNS.map((column) => (
        <col key={column.key} style={{ width: column.width }} />
      ))}
    </colgroup>
  );
}

function ColumnHeadings() {
  return (
    <thead>
      <tr>
        {COLUMNS.map((column) => (
          <th key={column.key} data-numeric={"numeric" in column && column.numeric ? "" : undefined}>
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Mirrors the real table so the layout does not shift when rows arrive. */
function DeploymentTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto" role="status" aria-label="Loading deployments">
      <table
        className="data-table data-table-fixed"
        style={{ minWidth: TABLE_MIN_WIDTH }}
        aria-hidden="true"
      >
        <ColumnRails />
        <ColumnHeadings />
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {COLUMNS.map((column, columnIndex) => (
                <td key={column.key}>
                  <Skeleton
                    className="h-3"
                    style={{ width: `${[62, 70, 78, 52, 66, 58, 72, 60, 48, 84][(rowIndex + columnIndex) % 10]}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TAB_LABEL = {
  overview: "Overview",
  build: "Build logs",
  runtime: "Runtime logs",
  domains: "Domains",
  raw: "Raw payload",
} as const;

const ENVIRONMENT_LABEL: Record<string, string> = {
  production: "Production",
  preview: "Preview",
  development: "Development",
  unknown: "Unknown",
};

function EnvironmentCell({ environment }: { environment: string }) {
  const label = ENVIRONMENT_LABEL[environment] ?? environment;
  return <Badge variant="outline" className={environment === "production" ? "text-ink" : undefined}>{label}</Badge>;
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
      <table
        className="data-table data-table-fixed"
        style={{ minWidth: TABLE_MIN_WIDTH }}
        role="grid"
        aria-label="Deployments"
        aria-rowcount={items.length}
      >
        <ColumnRails />
        <ColumnHeadings />
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
                  className="cursor-default outline-none"
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
                  onClick={(event) => {
                    event.currentTarget.focus();
                    setActive(index);
                    openDeployment(item);
                  }}
                >
                  <td><StatusBadge state={item.state} variant="plain" /></td>
                  <td className="truncate"><ProviderMark provider={item.provider} showIcon={prefs.data?.showProviderIcons} /></td>
                  <td className="truncate font-medium">{item.projectName}</td>
                  <td><EnvironmentCell environment={item.environment} /></td>
                  <td className="truncate">{item.branch ?? "—"}</td>
                  <td className="font-mono text-dense">{shortSha(item.commitSha, prefs.data?.fullCommitSha)}</td>
                  <td className="truncate text-muted">{item.author ?? "—"}</td>
                  <td data-numeric>{formatWhen(item.createdAt, prefs.data?.timeFormat ?? "relative")}</td>
                  <td data-numeric>{formatDuration(item.durationMs)}</td>
                  <td className="truncate text-muted">{item.url ?? "—"}</td>
                </tr>
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenuContent>
                  <DeploymentActions deployment={item} />
                </ContextMenuContent>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          ))}
        </tbody>
      </table>
    </div>
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
          {deployment.state === "ready" ? (
            <MenuItem
              onSelect={() =>
                ask({
                  title: "Instant rollback to this deployment",
                  body: `Production traffic for ${deployment.projectName} will point at this deployment.`,
                  actionLabel: "Roll back",
                  intent: "warning",
                  onConfirm: () =>
                    run("Rolled back", () => window.deployDeck.vercel.rollback(deployment.id, deployment.projectId)),
                })
              }
            >
              Instant rollback
            </MenuItem>
          ) : null}
          <MenuItem
            destructive
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
  const [tab, setTab] = useState<"overview" | "build" | "runtime" | "domains" | "raw">(() =>
    deployment.state === "queued" || deployment.state === "building" ? "build" : "overview",
  );
  const prefs = usePrefs();
  const client = useQueryClient();
  const [buildPaused, setBuildPaused] = useState(false);
  const openedId = useRef(deployment.id);

  useEffect(() => {
    if (openedId.current === deployment.id) return;
    openedId.current = deployment.id;
    setTab(deployment.state === "queued" || deployment.state === "building" ? "build" : "overview");
    setBuildPaused(false);
  }, [deployment.id, deployment.state]);

  const followMs = prefs.data?.refreshEnabled ? (prefs.data.activeRefreshIntervalMs ?? 5000) : false;
  const followWhileActive = (state: UnifiedDeployment["state"]) =>
    Boolean(followMs) && !buildPaused && (state === "queued" || state === "building");

  const detail = useQuery({
    queryKey: ["deployment", deployment.provider, deployment.id, deployment.projectId],
    queryFn: async () => {
      if (deployment.provider === "vercel") return window.deployDeck.vercel.getDeployment(deployment.id);
      if (deployment.provider === "cloudflare-pages") {
        return window.deployDeck.cloudflare.getPagesDeployment(deployment.accountId, deployment.projectName, deployment.id);
      }
      return deployment;
    },
    refetchInterval: (query) => {
      const state = query.state.data?.state ?? deployment.state;
      return followWhileActive(state) ? followMs : false;
    },
  });
  const buildLogs = useQuery({
    queryKey: ["build-logs", deployment.provider, deployment.id],
    enabled: tab === "build" && deployment.provider !== "cloudflare-workers",
    queryFn: async () => {
      if (deployment.provider === "vercel") return window.deployDeck.vercel.getBuildLogs(deployment.id);
      if (deployment.provider === "cloudflare-pages") {
        return window.deployDeck.cloudflare.getPagesLogs(deployment.accountId, deployment.projectName, deployment.id);
      }
      return [];
    },
    refetchInterval: () => {
      if (tab !== "build") return false;
      const state = detail.data?.state ?? deployment.state;
      return followWhileActive(state) ? followMs : false;
    },
  });
  const runtime = useQuery({
    queryKey: ["runtime-logs", deployment.provider, deployment.id],
    enabled: tab === "runtime" && deployment.provider === "vercel",
    queryFn: () => window.deployDeck.vercel.getRuntimeLogs(deployment.projectId, deployment.id),
  });

  const current = detail.data ?? deployment;
  const liveBuild = (current.state === "queued" || current.state === "building") && deployment.provider !== "cloudflare-workers";
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
          <TabsTrigger key={item} value={item}>
            {item === "runtime"
              ? deployment.provider === "cloudflare-workers"
                ? "Live tail"
                : "Runtime logs"
              : TAB_LABEL[item]}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="overview" className="overflow-auto p-4 text-dense">
        <dl className="divide-y divide-line/70">
          <DetailRow label="Status" value={<StatusBadge state={current.state} />} />
          <DetailRow label="Environment" value={current.environment} />
          <DetailRow label="Branch" value={current.branch ?? "—"} />
          <DetailRow label="Commit" value={shortSha(current.commitSha, prefs.data?.fullCommitSha)} mono />
          <DetailRow label="Message" value={current.commitMessage ?? "—"} />
          <DetailRow label="Author" value={current.author ?? "—"} />
          <DetailRow label="Created" value={formatWhen(current.createdAt, "absolute")} />
          <DetailRow label="Duration" value={formatDuration(current.durationMs)} />
          <DetailRow label="URL" value={current.url ?? "—"} />
        </dl>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 pt-3">
            {current.url ? (
              <Button size="sm" onClick={() => void window.deployDeck.shell.openHttps(current.url!)}>
                Open
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => void copyText(current.id)}>
              Copy ID
            </Button>
            {current.provider === "vercel" ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void runAction("Redeployment started", () => window.deployDeck.vercel.redeploy(current.id))}
                >
                  Redeploy
                </Button>
                {current.state === "ready" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      useUiStore.getState().askConfirm({
                        title: "Instant rollback to this deployment",
                        body: `Production traffic for ${current.projectName} will point at this deployment.`,
                        actionLabel: "Roll back",
                        intent: "warning",
                        onConfirm: () =>
                          runAction("Rolled back", () => window.deployDeck.vercel.rollback(current.id, current.projectId)),
                      })
                    }
                  >
                    Instant rollback
                  </Button>
                ) : null}
              </>
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
        {deployment.provider === "cloudflare-workers" ? (
          <EmptyState title="No build log" body="Workers do not emit a build log. Use Live tail for runtime output." />
        ) : (
          <LogViewer
            entries={buildLogs.data ?? []}
            loading={buildLogs.isLoading}
            live={liveBuild}
            paused={buildPaused}
            onPause={setBuildPaused}
            error={buildLogs.isError ? errorMessage(buildLogs.error) : undefined}
            onRetry={() => void buildLogs.refetch()}
          />
        )}
      </TabsContent>
      <TabsContent value="runtime" className="flex min-h-0 flex-1 flex-col">
        {deployment.provider === "vercel" ? (
          <LogViewer
            entries={runtimeEntries}
            loading={runtime.isLoading}
            unavailable={runtimeUnavailable}
            error={runtime.isError ? errorMessage(runtime.error) : undefined}
            onRetry={() => void runtime.refetch()}
          />
        ) : null}
        {deployment.provider === "cloudflare-workers" ? (
          <WorkerTailPanel accountId={deployment.accountId} scriptName={deployment.projectName} />
        ) : null}
        {deployment.provider === "cloudflare-pages" ? (
          <EmptyState title="No runtime tail" body="Pages deployments expose build logs. Use the Build tab." />
        ) : null}
      </TabsContent>
      <TabsContent value="domains" className="overflow-auto p-4 text-dense">
        <div className="divide-y divide-line/70">
          {(current.aliases.length > 0 ? current.aliases : [current.url]).filter(Boolean).map((alias) => (
            <div key={alias} className="flex min-h-9 items-center justify-between gap-2 py-1">
              <span className="min-w-0 truncate select-text">{alias}</span>
              <Button size="sm" variant="ghost" onClick={() => void window.deployDeck.shell.openHttps(alias!)}>
                Open
              </Button>
            </div>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="raw" className="flex min-h-0 flex-1 flex-col">
        <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-dense select-text">
          {JSON.stringify("metadata" in current ? (current as { metadata?: unknown }).metadata : current, null, 2)}
        </pre>
      </TabsContent>
    </Tabs>
  );
}
