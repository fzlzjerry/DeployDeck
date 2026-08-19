import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import type { DeploymentFilters, DeploymentState, UnifiedDeployment } from "@shared/models";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelRow,
  Readout,
  ReadoutStrip,
} from "@/components/ui/panel";
import { Button, Skeleton } from "@/components/ui/primitives";
import { useConnection, usePrefs } from "@/hooks/use-connection";
import { useActivity, useProjects, useUnifiedDeployments } from "@/hooks/use-data";
import { errorMessage, formatWhen, providerLabel } from "@/lib/format";
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
    <div className="h-full overflow-auto px-6 pb-8" aria-busy={deployments.isLoading || undefined}>
      {/* A readout strip, not a row of metric tiles: PRODUCT.md rules out
          giant metric cards and uptime theatre. */}
      <Panel>
        <PanelHeader
          title="Deployment pulse"
          description={`Loaded snapshot across ${providerSummary || "connected providers"}`}
          actions={
            <Button variant="ghost" size="sm" className="text-muted" onClick={() => showDeployments()}>
              All deployments
              <ArrowRight aria-hidden />
            </Button>
          }
        />
        <PanelBody padding="tight">
          <ReadoutStrip>
            <Readout
              label="In progress"
              tone="building"
              value={deployments.isLoading ? "—" : activeItems.length}
            />
            <Readout label="Failed" tone="failed" value={deployments.isLoading ? "—" : failedItems.length} />
            <Readout label="Ready" tone="ready" value={deployments.isLoading ? "—" : readyItems.length} />
            <div className="ml-auto">
              <Readout label="Loaded" value={deployments.isLoading ? "—" : items.length} />
            </div>
          </ReadoutStrip>
        </PanelBody>
        {deployments.isError ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5"
            role="alert"
          >
            <span className="text-dense text-failed-ink">The deployment snapshot could not be refreshed.</span>
            <Button variant="outline" size="sm" onClick={() => void deployments.refetch()}>
              Retry
            </Button>
          </div>
        ) : null}
      </Panel>

      <div className="mt-4 grid items-start gap-4 grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)] max-[1180px]:grid-cols-1">
        <div className="grid min-w-0 gap-4">
          <Section
            title="Needs attention"
            count={activeItems.length + failedItems.length}
            action={{ label: "View failed", onClick: () => showDeployments("failed") }}
          >
            {deployments.isLoading ? (
              <LoadingRows count={4} />
            ) : attentionItems.length === 0 ? (
              <EmptyState
                size="inline"
                title="Nothing needs attention"
                body="Deployments that are queued, building, or failed will surface here first."
              />
            ) : (
              attentionItems.map((item) => (
                <DeploymentRow
                  key={`${item.provider}:${item.id}`}
                  item={item}
                  timeFormat={timeFormat}
                  onOpen={openDeployment}
                />
              ))
            )}
          </Section>

          <Section title="Local activity" action={{ label: "View activity", onClick: () => setScreen("activity") }}>
            {activity.isLoading ? (
              <LoadingRows count={3} />
            ) : activity.isError ? (
              <ScreenError size="inline" message={errorMessage(activity.error)} onRetry={() => void activity.refetch()} />
            ) : (activity.data ?? []).length === 0 ? (
              <EmptyState
                size="inline"
                title="No local actions yet"
                body="Retries, promotions, and DNS edits you make here will appear in this timeline."
              />
            ) : (
              (activity.data ?? []).slice(0, 6).map((item) => (
                <PanelRow
                  key={item.id}
                  title={item.title}
                  trailing={
                    <time className="text-dense text-muted tabular" dateTime={item.at}>
                      {formatWhen(item.at, timeFormat)}
                    </time>
                  }
                />
              ))
            )}
          </Section>
        </div>

        <div className="grid min-w-0 gap-4">
          <Section
            title="Recently ready"
            count={readyItems.length}
            action={{ label: "View ready", onClick: () => showDeployments("ready") }}
          >
            {deployments.isLoading ? (
              <LoadingRows count={4} />
            ) : recentReady.length === 0 ? (
              <EmptyState
                size="inline"
                title="Nothing shipped yet"
                body="Successful deployments from the loaded snapshot land here."
              />
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
              <EmptyState
                size="inline"
                title="No projects loaded"
                body="Projects and Workers appear after the first refresh completes."
              />
            ) : (
              projectItems.map((project) => (
                <PanelRow
                  key={`${project.provider}:${project.id}`}
                  title={project.name}
                  description={providerLabel(project.provider)}
                  trailing={
                    <time className="text-dense text-muted tabular" dateTime={project.updatedAt}>
                      {formatWhen(project.updatedAt, timeFormat)}
                    </time>
                  }
                />
              ))
            )}
          </Section>
        </div>
      </div>
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
    <Panel>
      <PanelHeader
        title={title}
        count={count}
        size="sm"
        actions={
          action ? (
            <Button variant="ghost" size="sm" className="text-muted" onClick={action.onClick}>
              {action.label}
              <ArrowRight aria-hidden />
            </Button>
          ) : undefined
        }
      />
      <PanelBody padding="none" divided>
        {children}
      </PanelBody>
    </Panel>
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
    <PanelRow
      onActivate={() => onOpen(item)}
      activateLabel={`Inspect ${item.projectName}`}
      title={item.projectName}
      description={context}
      // Every row in the compact panel is already "ready", so the pill would
      // repeat the panel title.
      leading={compact ? undefined : <StatusBadge state={item.state} />}
      trailing={
        <>
          <time className="text-dense text-muted tabular" dateTime={item.createdAt}>
            {formatWhen(item.createdAt, timeFormat)}
          </time>
          <ArrowRight
            className="size-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
            aria-hidden
          />
        </>
      }
    />
  );
}

/** Direct children so the panel's own dividers land between rows. */
function LoadingRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          aria-hidden
          className="flex min-h-11 items-center justify-between gap-6 px-4 py-2"
        >
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </>
  );
}
