import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import type { DeploymentFilters, DeploymentState, UnifiedDeployment } from "@shared/models";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Button, Skeleton } from "@/components/ui/primitives";
import { useConnection, usePrefs } from "@/hooks/use-connection";
import { useActivity, useProjects, useUnifiedDeployments } from "@/hooks/use-data";
import { errorMessage, formatWhen, providerLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/ui-store";

const OVERVIEW_FILTERS: DeploymentFilters = {
  provider: "all",
  accountId: "all",
  state: "all",
  environment: "all",
};

export function OverviewScreen() {
  const connection = useConnection();
  const setScreen = useUiStore((state) => state.setScreen);
  const setFilters = useUiStore((state) => state.setFilters);
  const deployments = useUnifiedDeployments(OVERVIEW_FILTERS);
  const projects = useProjects();
  const activity = useActivity();
  const prefs = usePrefs();
  const openDeployment = useUiStore((state) => state.openDeployment);
  const items = deployments.data?.pages.flatMap((page) => page.items) ?? [];
  const activeItems = items.filter((item) => item.state === "queued" || item.state === "building");
  const failedItems = items.filter((item) => item.state === "failed");
  const readyItems = items.filter((item) => item.state === "ready");
  const attentionItems = [...activeItems, ...failedItems]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8);
  const recentReady = readyItems.slice(0, 6);
  const projectItems = [...(projects.data?.vercel ?? []), ...(projects.data?.pages ?? [])]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 6);
  const providerSummary = [
    connection.data?.vercel.connected && "Vercel",
    connection.data?.cloudflare.connected && "Cloudflare",
  ]
    .filter(Boolean)
    .join(" and ");
  const timeFormat = prefs.data?.timeFormat ?? "relative";

  const showDeployments = (state: DeploymentState | "all" = "all") => {
    setFilters({
      provider: "all",
      accountId: "all",
      state,
      environment: "all",
      branch: undefined,
      query: undefined,
    });
    setScreen("deployments");
  };

  if (!connection.data?.vercel.connected && !connection.data?.cloudflare.connected) {
    return (
      <EmptyState
        title="Connect a provider"
        body="Deployments and projects appear here after a Vercel or Cloudflare token is saved."
        action={{ label: "Open settings", onClick: () => setScreen("settings") }}
      />
    );
  }

  return (
    <div className="h-full overflow-auto" aria-busy={deployments.isLoading || undefined}>
      <section className="border-b border-line px-5 py-4" aria-labelledby="deployment-pulse-title">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="deployment-pulse-title" className="text-[13px] font-semibold tracking-[-0.01em]">
              Deployment pulse
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              Loaded snapshot across {providerSummary || "connected providers"}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="-mr-2 shrink-0 text-muted" onClick={() => showDeployments()}>
            All deployments
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </div>
        <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
          <Signal label="In progress" value={activeItems.length} tone="building" loading={deployments.isLoading} />
          <Signal label="Failed" value={failedItems.length} tone="failed" loading={deployments.isLoading} />
          <Signal label="Ready" value={readyItems.length} tone="ready" loading={deployments.isLoading} />
          <div className="ml-auto flex items-center gap-1.5 text-muted tabular">
            <dt>Loaded</dt>
            <dd className="font-medium text-ink">{deployments.isLoading ? "—" : items.length}</dd>
          </div>
        </dl>
        {deployments.isError ? (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-[12px]" role="alert">
            <span className="text-failed">The deployment snapshot could not be refreshed.</span>
            <Button variant="ghost" size="sm" onClick={() => void deployments.refetch()}>
              Retry
            </Button>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)] gap-x-8 px-5 pb-6 max-[1100px]:grid-cols-1">
        <div className="min-w-0">
          <Section
            title="Needs attention"
            count={activeItems.length + failedItems.length}
            action={{ label: "View failed", onClick: () => showDeployments("failed") }}
          >
            {deployments.isLoading ? (
              <LoadingRows count={4} />
            ) : attentionItems.length === 0 ? (
              <EmptyRow>Nothing is building or failing in the loaded snapshot.</EmptyRow>
            ) : (
              attentionItems.map((item) => (
                <DeploymentRow key={`${item.provider}:${item.id}`} item={item} timeFormat={timeFormat} onOpen={openDeployment} />
              ))
            )}
          </Section>

          <Section title="Local activity" action={{ label: "View activity", onClick: () => setScreen("activity") }}>
            {activity.isLoading ? (
              <LoadingRows count={3} />
            ) : activity.isError ? (
              <ScreenError size="inline" message={errorMessage(activity.error)} onRetry={() => void activity.refetch()} />
            ) : (activity.data ?? []).length === 0 ? (
              <EmptyRow>Retries, promotions, and DNS edits made here will appear in this timeline.</EmptyRow>
            ) : (
              (activity.data ?? []).slice(0, 6).map((item) => (
                <div key={item.id} className="flex min-h-9 items-center justify-between gap-4 border-b border-line/70 py-2 last:border-0">
                  <span className="min-w-0 truncate text-[12px]">{item.title}</span>
                  <time className="shrink-0 text-[11px] text-muted tabular" dateTime={item.at}>
                    {formatWhen(item.at, timeFormat)}
                  </time>
                </div>
              ))
            )}
          </Section>
        </div>

        <div className="min-w-0">
          <Section
            title="Recently ready"
            count={readyItems.length}
            action={{ label: "View ready", onClick: () => showDeployments("ready") }}
          >
            {deployments.isLoading ? (
              <LoadingRows count={4} />
            ) : recentReady.length === 0 ? (
              <EmptyRow>No ready deployments are loaded yet.</EmptyRow>
            ) : (
              recentReady.map((item) => (
                <DeploymentRow
                  key={`${item.provider}:${item.id}`}
                  item={item}
                  timeFormat={timeFormat}
                  onOpen={openDeployment}
                  compact
                />
              ))
            )}
          </Section>

          <Section title="Recently modified" action={{ label: "View projects", onClick: () => setScreen("projects") }}>
            {projects.isLoading ? (
              <LoadingRows count={3} />
            ) : projects.isError ? (
              <ScreenError size="inline" message={errorMessage(projects.error)} onRetry={() => void projects.refetch()} />
            ) : projectItems.length === 0 ? (
              <EmptyRow>Projects will appear after the first refresh.</EmptyRow>
            ) : (
              projectItems.map((project) => (
                <div
                  key={`${project.provider}:${project.id}`}
                  className="flex min-h-9 items-center justify-between gap-4 border-b border-line/70 py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium">{project.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted">{providerLabel(project.provider)}</p>
                  </div>
                  <time className="shrink-0 text-[11px] text-muted tabular" dateTime={project.updatedAt}>
                    {formatWhen(project.updatedAt, timeFormat)}
                  </time>
                </div>
              ))
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Signal({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number;
  tone: "building" | "failed" | "ready";
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "building" && "bg-building",
          tone === "failed" && "bg-failed",
          tone === "ready" && "bg-ready",
        )}
        aria-hidden
      />
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink tabular">{loading ? "—" : value}</dd>
    </div>
  );
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <section className="mt-5 min-w-0 border-t border-line pt-3">
      <div className="mb-1 flex min-h-7 items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold">
          {title}
          {typeof count === "number" ? <span className="ml-1.5 font-normal text-muted tabular">{count}</span> : null}
        </h2>
        {action ? (
          <Button variant="ghost" size="sm" className="-mr-2 h-7 shrink-0 text-[11px] text-muted" onClick={action.onClick}>
            {action.label}
            <ArrowRight className="size-3" aria-hidden />
          </Button>
        ) : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

function DeploymentRow({
  item,
  timeFormat,
  onOpen,
  compact = false,
}: {
  item: UnifiedDeployment;
  timeFormat: "relative" | "absolute";
  onOpen: (item: UnifiedDeployment) => void;
  compact?: boolean;
}) {
  const context = [providerLabel(item.provider), item.environment, item.branch].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      className={cn(
        "group flex min-h-10 w-full items-center justify-between gap-4 border-b border-line/70 px-2 py-2 text-left last:border-0",
        "-mx-2 rounded-md transition-colors duration-150 ease-[var(--ease-out-expo)] motion-reduce:transition-none",
        "hover:bg-surface focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
      )}
      onClick={() => onOpen(item)}
    >
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-ink">{item.projectName}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted">{context}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {!compact ? <StatusBadge state={item.state} /> : null}
        <time className="text-[11px] text-muted tabular" dateTime={item.createdAt}>
          {formatWhen(item.createdAt, timeFormat)}
        </time>
        <ArrowRight className="size-3 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
      </div>
    </button>
  );
}

function EmptyRow({ children }: { children: string }) {
  return <EmptyState size="inline" title={children} />;
}

function LoadingRows({ count }: { count: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex min-h-10 items-center justify-between gap-6 border-b border-line/70 py-2 last:border-0">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
