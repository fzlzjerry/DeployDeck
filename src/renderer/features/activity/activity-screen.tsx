import { useQueryClient } from "@tanstack/react-query";
import { History, Trash2 } from "lucide-react";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { ScreenToolbar } from "@/components/ui/layout";
import { Badge, Button, TableSkeleton } from "@/components/ui/primitives";
import { usePrefs } from "@/hooks/use-connection";
import { useActivity, useUnifiedDeployments } from "@/hooks/use-data";
import { errorMessage, formatWhen } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";

export function ActivityScreen() {
  const activity = useActivity();
  const deployments = useUnifiedDeployments({ provider: "all" });
  const prefs = usePrefs();
  const client = useQueryClient();
  const openDeployment = useUiStore((state) => state.openDeployment);
  const setScreen = useUiStore((state) => state.setScreen);
  const setFilters = useUiStore((state) => state.setFilters);
  const deploymentItems = deployments.data?.pages.flatMap((page) => page.items) ?? [];
  const local = activity.data ?? [];
  const derived = deploymentItems.slice(0, 40).map((item) => ({
    id: `dep-${item.id}`,
    at: item.createdAt,
    title: `${item.projectName} ${item.state}`,
    detail: item.commitMessage,
    kind: "deployment",
    projectName: item.projectName,
    targetId: item.id,
  }));
  const rows = [
    ...local.map((item) => ({ ...item, source: "Local" as const })),
    ...derived.map((item) => ({ ...item, source: "Provider" as const })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const loading = activity.isLoading || deployments.isLoading;
  const error = activity.isError ? activity.error : deployments.isError ? deployments.error : undefined;

  const retry = () => {
    if (activity.isError) void activity.refetch();
    if (deployments.isError) void deployments.refetch();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenToolbar className="justify-between">
        <div>
          <p className="text-[12px] font-medium">Workspace timeline</p>
          <p className="text-[11px] text-muted">Local actions plus recent fetched deployments, not a provider audit log.</p>
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
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-6">
        <div className="mx-auto max-w-4xl">
          {loading && rows.length === 0 ? (
            <TableSkeleton columns={3} rows={6} label="Loading activity" className="px-0 py-3" />
          ) : error && rows.length === 0 ? (
            <ScreenError message={errorMessage(error)} onRetry={retry} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No activity yet"
              body="Actions you take in DeployDeck and the latest fetched deployments will appear here."
              icon={<History />}
            />
          ) : (
            <ol>
              {rows.map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[18px_minmax(0,1fr)_auto] gap-3 border-b border-line/70 py-3 last:border-b-0"
                >
                  <button
                    type="button"
                    className="contents"
                    onClick={() => {
                      const match = deploymentItems.find((deployment) => `dep-${deployment.id}` === item.id || deployment.id === item.targetId);
                      if (match) {
                        openDeployment(match);
                        return;
                      }
                      if (item.projectName) {
                        setFilters({ query: item.projectName, projectId: undefined, state: "all" });
                        setScreen("deployments");
                      }
                    }}
                  >
                  <span className="mt-1.5 size-2 rounded-full bg-surface-3" aria-hidden />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[12px] font-medium">{item.title}</p>
                      <Badge variant="neutral" className="shrink-0">
                        {item.source}
                      </Badge>
                    </div>
                    {item.detail ? <p className="mt-0.5 truncate text-[11px] text-muted">{item.detail}</p> : null}
                  </div>
                  <time className="shrink-0 pt-0.5 text-[11px] text-muted tabular" dateTime={item.at}>
                    {formatWhen(item.at, prefs.data?.timeFormat ?? "relative")}
                  </time>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
