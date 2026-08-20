import type { ActivityKind, LocalActivityEntry, Provider, UnifiedDeployment } from "@shared/models";
import { useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Globe2,
  History,
  Plug,
  Rocket,
  SlidersHorizontal,
  Trash2,
  Waypoints,
} from "lucide-react";
import type { ComponentType } from "react";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { ScreenToolbar } from "@/components/ui/layout";
import { Panel, PanelBody, PanelHeader, PanelRowButton } from "@/components/ui/panel";
import { Badge, Button, TableSkeleton } from "@/components/ui/primitives";
import { usePrefs } from "@/hooks/use-connection";
import { useActivity, useUnifiedDeployments } from "@/hooks/use-data";
import { dayKey, dayLabel, errorMessage, formatWhen } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";

/**
 * An icon per kind rather than a colour per kind. The dot this replaces was
 * the same tone for every event, so it carried no information; six status
 * colours would carry it at the cost of the one-lamp budget.
 */
const KIND_ICON: Array<[string, ComponentType<{ className?: string; strokeWidth?: number }>]> = [
  ["deployment-", Rocket],
  ["domain-", Globe2],
  ["dns-", Waypoints],
  ["env-", SlidersHorizontal],
  ["worker-", Boxes],
  ["connection-", Plug],
];

function KindGlyph({ kind }: { kind: ActivityKind }) {
  const match = KIND_ICON.find(([prefix]) => kind.startsWith(prefix));
  const Icon = match?.[1] ?? History;
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-muted"
    >
      <Icon className="size-3.5" strokeWidth={1.75} />
    </span>
  );
}

export function ActivityScreen() {
  const activity = useActivity();
  const deployments = useUnifiedDeployments({ provider: "all" });
  const prefs = usePrefs();
  const client = useQueryClient();
  const openDeployment = useUiStore((state) => state.openDeployment);
  const setScreen = useUiStore((state) => state.setScreen);
  const openProject = useUiStore((state) => state.openProject);
  const openZone = useUiStore((state) => state.openZone);
  const openEnvironment = useUiStore((state) => state.openEnvironment);
  const local = activity.data ?? [];
  const fetched = deployments.data?.pages.flatMap((page) => page.items) ?? [];
  const derived = fetched.slice(0, 40).map((item) => ({
    id: `dep-${item.id}`,
    at: item.createdAt,
    title: item.projectName,
    detail: item.commitMessage,
    kind: "deployment-redeployed" as const,
    provider: item.provider,
    projectName: item.projectName,
    targetId: item.id,
    deployment: item,
  }));
  const rows = [
    ...local.map((item) => ({ ...item, source: "Local" as const, deployment: undefined as UnifiedDeployment | undefined })),
    ...derived.map((item) => ({ ...item, source: "Provider" as const })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // Grouped by calendar day so a long feed reads as a timeline rather than as
  // one undifferentiated list.
  const groups: Array<{ key: string; label: string; items: typeof rows }> = [];
  for (const row of rows) {
    const key = dayKey(row.at);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(row);
    else groups.push({ key, label: dayLabel(row.at), items: [row] });
  }

  const openRow = (item: (typeof rows)[number]) => {
    if (item.deployment) {
      openDeployment(item.deployment);
      return;
    }
    openActivityTarget(item, fetched, { openDeployment, setScreen, openProject, openZone, openEnvironment });
  };

  const loading = activity.isLoading || deployments.isLoading;
  const refreshing = (activity.isFetching || deployments.isFetching) && !loading;
  const error = activity.isError ? activity.error : deployments.isError ? deployments.error : undefined;

  const retry = () => {
    if (activity.isError) void activity.refetch();
    if (deployments.isError) void deployments.refetch();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenToolbar className="justify-between">
        <div className="flex items-center gap-3 text-dense text-muted">
          {/* Surfaced even when rows are already on screen, so a refresh of one
              source is visible instead of silent. */}
          {refreshing ? <span>Updating…</span> : null}
          {loading ? null : (
            <span className="tabular">
              {rows.length} {rows.length === 1 ? "event" : "events"}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted"
          disabled={local.length === 0}
          onClick={async () => {
            await window.deployDeck.activity.clear();
            await client.invalidateQueries({ queryKey: ["activity"] });
          }}
        >
          <Trash2 aria-hidden />
          Clear local history
        </Button>
      </ScreenToolbar>
      <div className="min-h-0 flex-1 overflow-auto px-6 pb-8">
        <div className="max-w-4xl">
          {loading && rows.length === 0 ? (
            <Panel>
              <TableSkeleton columns={3} rows={6} label="Loading activity" />
            </Panel>
          ) : error && rows.length === 0 ? (
            <ScreenError message={errorMessage(error)} onRetry={retry} framed />
          ) : rows.length === 0 ? (
            <EmptyState
              framed
              title="No activity yet"
              body="Retries, promotions, DNS edits, and env changes you make here are recorded locally, alongside the latest deployments fetched from your providers."
              icon={<History strokeWidth={1.75} />}
            />
          ) : (
            <div className="grid gap-4">
              {groups.map((group) => (
                <Panel key={group.key}>
                  <PanelHeader title={group.label} count={group.items.length} size="sm" />
                  <PanelBody padding="none" divided>
                    {group.items.map((item) => (
                      <PanelRowButton
                        key={item.id}
                        onClick={() => openRow(item)}
                        aria-label={`Open ${item.title}`}
                        leading={<KindGlyph kind={item.kind as ActivityKind} />}
                        title={item.title}
                        description={item.detail || undefined}
                        trailing={
                          <>
                            {item.deployment ? (
                              <StatusBadge state={item.deployment.state} />
                            ) : (
                              <Badge variant="neutral">{item.source}</Badge>
                            )}
                            <time className="text-dense text-muted tabular" dateTime={item.at}>
                              {formatWhen(item.at, prefs.data?.timeFormat ?? "relative")}
                            </time>
                          </>
                        }
                      />
                    ))}
                  </PanelBody>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function openActivityTarget(
  item: Pick<LocalActivityEntry, "kind" | "provider" | "projectName" | "targetId">,
  deployments: UnifiedDeployment[],
  actions: {
    openDeployment: (deployment: UnifiedDeployment) => void;
    setScreen: (screen: "deployments" | "projects" | "domains" | "dns" | "environments") => void;
    openProject: (focus: { kind: "project"; provider: Provider; id: string } | { kind: "worker"; accountId: string; name: string }) => void;
    openZone: (zoneId: string) => void;
    openEnvironment: (focus: { provider: "vercel" | "cloudflare-pages" | "cloudflare-workers"; targetId: string }) => void;
  },
) {
  const kind = item.kind as ActivityKind;
  if (kind.startsWith("deployment-")) {
    const match = deployments.find((deployment) => deployment.id === item.targetId);
    if (match) actions.openDeployment(match);
    else actions.setScreen("deployments");
    return;
  }
  if (kind.startsWith("domain-")) {
    actions.setScreen("domains");
    return;
  }
  if (kind.startsWith("dns-")) {
    if (item.targetId) actions.openZone(item.targetId);
    else actions.setScreen("dns");
    return;
  }
  if (kind.startsWith("env-")) {
    if (item.provider && item.provider !== "cloudflare" && item.targetId) {
      actions.openEnvironment({ provider: item.provider, targetId: item.targetId });
    } else actions.setScreen("environments");
    return;
  }
  if (kind.startsWith("worker-") && item.projectName) {
    actions.openProject({
      kind: "worker",
      accountId: item.targetId ?? "",
      name: item.projectName,
    });
    return;
  }
}
