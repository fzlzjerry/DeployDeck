import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { DeploymentFilters, UnifiedDeployment } from "@shared/models";
import { useConnection, usePrefs } from "./use-connection";

export function useProjects() {
  const connection = useConnection();
  const vercel = connection.data?.vercel.connected;
  const cloudflare = connection.data?.cloudflare.connected;
  return useQuery({
    queryKey: ["projects", vercel, cloudflare, connection.data?.vercel.activeTeamId, connection.data?.cloudflare.activeAccountId],
    enabled: Boolean(vercel || cloudflare),
    queryFn: async () => {
      const [v, p, w] = await Promise.all([
        vercel ? window.deployDeck.vercel.listProjects() : [],
        cloudflare ? window.deployDeck.cloudflare.listPagesProjects() : [],
        cloudflare ? window.deployDeck.cloudflare.listWorkers() : [],
      ]);
      return { vercel: v, pages: p, workers: w };
    },
  });
}

export function useUnifiedDeployments(filters: DeploymentFilters) {
  const connection = useConnection();
  const prefs = usePrefs();
  const vercelOn = Boolean(connection.data?.vercel.connected) && (filters.provider === "all" || filters.provider === "vercel");
  const pagesOn = Boolean(connection.data?.cloudflare.connected) && (filters.provider === "all" || filters.provider === "cloudflare-pages");
  const workersOn = Boolean(connection.data?.cloudflare.connected) && (filters.provider === "all" || filters.provider === "cloudflare-workers");
  const interval = prefs.data?.refreshEnabled
    ? prefs.data.activeRefreshIntervalMs
    : false;

  return useInfiniteQuery({
    queryKey: ["deployments", filters, connection.data?.vercel.activeTeamId, connection.data?.cloudflare.activeAccountId],
    enabled: vercelOn || pagesOn || workersOn,
    placeholderData: keepPreviousData,
    initialPageParam: { vercel: undefined as string | undefined, pages: undefined as string | undefined },
    queryFn: async ({ pageParam }) => {
      const [vercel, pages, workers] = await Promise.all([
        vercelOn
          ? window.deployDeck.vercel.listDeployments({
              ...filters,
              provider: "vercel",
              cursor: pageParam.vercel,
              limit: 20,
            })
          : { items: [], hasMore: false, nextCursor: undefined },
        pagesOn
          ? window.deployDeck.cloudflare.listPagesDeployments({
              ...filters,
              accountId: filters.accountId === "all" ? undefined : filters.accountId,
              projectName: filters.projectId,
              cursor: pageParam.pages,
              limit: 20,
            })
          : { items: [], hasMore: false, nextCursor: undefined },
        workersOn && !pageParam.vercel && !pageParam.pages
          ? window.deployDeck.cloudflare.listWorkers(filters.accountId === "all" ? undefined : filters.accountId).then(async (scripts) => {
              const deployments: UnifiedDeployment[] = [];
              const scoped = filters.projectId ? scripts.filter((script) => script.name === filters.projectId) : scripts;
              for (const script of scoped.slice(0, 30)) {
                const rows = await window.deployDeck.cloudflare.listWorkerDeployments(script.accountId, script.name);
                deployments.push(
                  ...rows.map((row) => ({
                    id: row.id,
                    provider: "cloudflare-workers" as const,
                    accountId: row.accountId,
                    accountName: row.accountName,
                    projectId: row.scriptName,
                    projectName: row.scriptName,
                    state: "ready" as const,
                    environment: "production" as const,
                    aliases: [],
                    commitSha: row.versions[0]?.versionId,
                    commitMessage: row.versions.map((item) => `${item.percentage}%`).join(" / "),
                    author: row.source,
                    createdAt: row.createdOn ?? new Date().toISOString(),
                  })),
                );
              }
              return { items: deployments, hasMore: false };
            })
          : { items: [] as UnifiedDeployment[], hasMore: false },
      ]);
      const items = [...vercel.items, ...pages.items, ...workers.items].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
      return {
        items,
        next: {
          vercel: vercel.nextCursor,
          pages: pages.nextCursor,
        },
        hasMore: Boolean(vercel.hasMore || pages.hasMore),
      };
    },
    getNextPageParam: (last) => (last.hasMore ? last.next : undefined),
    refetchInterval: (query) => {
      const items = query.state.data?.pages.flatMap((page) => page.items) ?? [];
      const active = items.some((item) => item.state === "queued" || item.state === "building");
      if (!prefs.data?.refreshEnabled) return false;
      return active ? interval : prefs.data.refreshIntervalMs;
    },
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ["activity"],
    queryFn: () => window.deployDeck.activity.list(),
  });
}

export function useZones() {
  const connection = useConnection();
  return useQuery({
    queryKey: ["zones", connection.data?.cloudflare.activeAccountId],
    enabled: Boolean(connection.data?.cloudflare.connected),
    queryFn: () => window.deployDeck.cloudflare.listZones(),
  });
}
