import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Star } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { EnvironmentVariable, Provider, UnifiedProject, WorkerScript } from "@shared/models";
import { watchKey } from "@shared/watch";
import { VerificationRecords } from "@/features/domains/verification-records";
import { WorkerDomainsPanel, WorkerRoutesPanel } from "@/features/projects/worker-network";
import { useWatchlist } from "@/hooks/use-watchlist";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { ProviderMark, StatusBadge } from "@/components/common/status-badge";
import { DetailRow, InspectorHeader, InspectorPanel, ScreenToolbar } from "@/components/ui/layout";
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
import { useProjects } from "@/hooks/use-data";
import { cn } from "@/lib/cn";
import { errorMessage, formatWhen, providerLabel } from "@/lib/format";
import { projectToFocus, useUiStore, type ProjectFocus } from "@/stores/ui-store";
import { toast } from "sonner";

type ProviderFilter = "all" | "vercel" | "cloudflare-pages" | "cloudflare-workers";

type ProjectTableEntry =
  | { kind: "project"; key: string; item: UnifiedProject }
  | { kind: "worker"; key: string; item: WorkerScript };

const PROVIDER_OPTIONS = [
  { value: "all", label: "All providers" },
  { value: "vercel", label: "Vercel" },
  { value: "cloudflare-pages", label: "Cloudflare Pages" },
  { value: "cloudflare-workers", label: "Cloudflare Workers" },
] as const;

export function ProjectsScreen() {
  const connection = useConnection();
  const projects = useProjects();
  const prefs = usePrefs();
  const [provider, setProvider] = useState<ProviderFilter>("all");
  const [query, setQuery] = useState("");
  const selected = useUiStore((state) => state.selectedProject);
  const openProject = useUiStore((state) => state.openProject);
  const watchlist = useWatchlist();
  const normalizedQuery = query.trim().toLowerCase();

  const projectEntries: ProjectTableEntry[] = [
    ...(provider === "all" || provider === "vercel" ? (projects.data?.vercel ?? []) : []),
    ...(provider === "all" || provider === "cloudflare-pages" ? (projects.data?.pages ?? []) : []),
  ]
    .filter((item) => !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery))
    .map((item) => ({ kind: "project" as const, key: `${item.provider}:${item.id}`, item }));

  const workerEntries: ProjectTableEntry[] = (
    provider === "all" || provider === "cloudflare-workers" ? (projects.data?.workers ?? []) : []
  )
    .filter((item) => !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery))
    .map((item) => ({ kind: "worker" as const, key: `worker:${item.accountId}:${item.name}`, item }));

  const entries = [...projectEntries, ...workerEntries];
  const hasFilters = provider !== "all" || Boolean(normalizedQuery);
  const clearFilters = () => {
    setProvider("all");
    setQuery("");
  };

  if (!connection.data?.vercel.connected && !connection.data?.cloudflare.connected) {
    return <EmptyState title="No projects" body="Connect Vercel or Cloudflare to list projects." />;
  }
  if (projects.isError) return <ScreenError message={errorMessage(projects.error)} onRetry={() => void projects.refetch()} />;

  return (
    <div className="relative flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <ScreenToolbar role="search" aria-label="Filter projects and workers">
          <Input
            type="search"
            aria-label="Search projects and workers"
            placeholder="Search projects and workers"
            className="w-64"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <SelectControl
            ariaLabel="Filter by provider"
            className="w-44"
            value={provider}
            onValueChange={(value) => setProvider(value as ProviderFilter)}
            options={PROVIDER_OPTIONS}
          />
          {hasFilters ? (
            <Button variant="ghost" size="sm" className="text-muted" onClick={clearFilters}>
              Reset filters
            </Button>
          ) : null}
          <span className="ml-auto text-[11px] text-muted tabular" aria-live="polite">
            {projects.isFetching && !projects.isLoading ? "Updating…" : `${entries.length} shown`}
          </span>
        </ScreenToolbar>

        {projects.isLoading ? (
          <div className="space-y-2 p-4" aria-label="Loading projects">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-8" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No projects match" : "No projects found"}
            body={hasFilters ? "Adjust the search or provider filter to return to the full list." : "Connected projects will appear after the first refresh."}
            action={hasFilters ? { label: "Reset filters", onClick: clearFilters } : undefined}
          />
        ) : (
          <ProjectsTable
            entries={entries}
            selected={selected}
            onSelect={openProject}
            watchedKeys={watchlist.keys}
            onToggleWatch={(provider, id, accountId) => void watchlist.toggle(provider, id, accountId)}
            showProviderIcons={prefs.data?.showProviderIcons}
            timeFormat={prefs.data?.timeFormat ?? "relative"}
          />
        )}
      </div>

      {selected ? (
        <ProjectInspector selected={selected} onClose={() => useUiStore.setState({ selectedProject: undefined })} />
      ) : null}
    </div>
  );
}

function ProjectsTable({
  entries,
  selected,
  onSelect,
  watchedKeys,
  onToggleWatch,
  showProviderIcons,
  timeFormat,
}: {
  entries: ProjectTableEntry[];
  selected?: ProjectFocus;
  onSelect: (selection: ProjectFocus) => void;
  watchedKeys: string[];
  onToggleWatch: (provider: Provider, id: string, accountId?: string) => void;
  showProviderIcons?: boolean;
  timeFormat: "relative" | "absolute";
}) {
  const [active, setActive] = useState(-1);
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const selectedKey = selectionKey(selected);

  useEffect(() => {
    if (active >= entries.length) setActive(-1);
  }, [active, entries.length]);

  const focusRow = (index: number) => {
    if (entries.length === 0) return;
    const next = Math.max(0, Math.min(entries.length - 1, index));
    setActive(next);
    window.requestAnimationFrame(() => rowRefs.current[next]?.focus());
  };

  const selectEntry = (entry: ProjectTableEntry) => {
    if (entry.kind === "project") onSelect(projectToFocus(entry.item));
    else {
      onSelect({
        kind: "worker",
        accountId: entry.item.accountId,
        accountName: entry.item.accountName,
        name: entry.item.name,
      });
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="data-table min-w-[820px]" aria-label="Projects and workers">
        <thead>
          <tr>
            <th>Watch</th>
            <th>Provider</th>
            <th>Name</th>
            <th>Account</th>
            <th>Production branch</th>
            <th>State or version</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const rowSelected = selectedKey === entry.key;
            const item = entry.item;
            return (
              <tr
                key={entry.key}
                ref={(node) => {
                  rowRefs.current[index] = node;
                }}
                tabIndex={active === index || (active === -1 && index === 0) ? 0 : -1}
                aria-selected={rowSelected || undefined}
                className="cursor-default outline-none"
                onFocus={() => setActive(index)}
                onClick={() => {
                  setActive(index);
                  selectEntry(entry);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    focusRow(index + 1);
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    focusRow(index - 1);
                  }
                  if (event.key === "Home") {
                    event.preventDefault();
                    focusRow(0);
                  }
                  if (event.key === "End") {
                    event.preventDefault();
                    focusRow(entries.length - 1);
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectEntry(entry);
                  }
                }}
              >
                <td className="w-10">
                  <WatchButton
                    watched={watchedKeys.includes(
                      entry.kind === "project"
                        ? watchKey(entry.item.provider, entry.item.id, entry.item.accountId)
                        : watchKey("cloudflare-workers", entry.item.name, entry.item.accountId),
                    )}
                    onClick={() =>
                      onToggleWatch(
                        entry.kind === "project" ? entry.item.provider : "cloudflare-workers",
                        entry.kind === "project" ? entry.item.id : entry.item.name,
                        entry.item.accountId,
                      )
                    }
                    label={item.name}
                  />
                </td>
                <td>
                  <ProviderMark
                    provider={entry.kind === "project" ? entry.item.provider : "cloudflare-workers"}
                    showIcon={showProviderIcons}
                  />
                </td>
                <td className="max-w-56">
                  <span className="block truncate font-medium text-ink">{item.name}</span>
                </td>
                <td className="max-w-52">
                  <span className="block truncate text-muted">{item.accountName}</span>
                </td>
                <td>{entry.kind === "project" ? entry.item.productionBranch ?? "—" : "—"}</td>
                <td>
                  {entry.kind === "project" ? (
                    entry.item.latestDeploymentState ? <StatusBadge state={entry.item.latestDeploymentState} /> : "—"
                  ) : entry.item.activeVersionId ? (
                    <span className="font-mono">{entry.item.activeVersionId.slice(0, 8)}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-muted tabular">
                  {formatWhen(entry.kind === "project" ? entry.item.updatedAt : entry.item.modifiedOn, timeFormat)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function selectionKey(selection?: ProjectFocus): string | undefined {
  if (!selection) return undefined;
  if (selection.kind === "worker") return `worker:${selection.accountId}:${selection.name}`;
  return `${selection.provider}:${selection.id}`;
}

function WatchButton({
  watched,
  onClick,
  label,
}: {
  watched: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-7"
      aria-pressed={watched}
      aria-label={watched ? `Stop watching ${label}` : `Watch ${label}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Star className={watched ? "fill-ember text-ember-ink" : "text-muted"} aria-hidden />
    </Button>
  );
}

function ProjectInspector({ selected, onClose }: { selected: ProjectFocus; onClose: () => void }) {
  const worker = selected.kind === "worker";
  const title = selected.name;
  const subtitle = worker
    ? `${selected.accountName} · Cloudflare Workers`
    : `${selected.accountName} · ${providerLabel(selected.provider)}`;
  const project = useQuery({
    queryKey: ["project-detail", selected.kind, selected.kind === "project" ? selected.provider : "worker", selected.kind === "project" ? selected.id : selected.name, selected.accountId],
    enabled: selected.kind === "project",
    queryFn: async () => {
      if (selected.kind !== "project") throw new Error("Not a project.");
      return selected.provider === "vercel"
        ? window.deployDeck.vercel.getProject(selected.id)
        : window.deployDeck.cloudflare.getPagesProject(selected.accountId, selected.name);
    },
  });
  const dashboardUrl = worker
    ? `https://dash.cloudflare.com/${selected.accountId}/workers/services/view/${selected.name}`
    : project.data?.dashboardUrl;

  return (
    <InspectorPanel size="md" className="deployment-inspector" aria-label={`${title} inspector`}>
      <InspectorHeader
        title={title}
        subtitle={subtitle}
        closeLabel={`Close ${title} inspector`}
        onClose={onClose}
        actions={
          dashboardUrl ? (
            <Button size="sm" variant="secondary" onClick={() => void window.deployDeck.shell.openHttps(dashboardUrl)}>
              Dashboard
              <ExternalLink aria-hidden />
            </Button>
          ) : null
        }
      />
      {worker ? (
        <WorkerDetail key={`worker:${selected.accountId}:${selected.name}`} accountId={selected.accountId} name={selected.name} />
      ) : project.isLoading ? (
        <PanelLoading />
      ) : project.isError || !project.data ? (
        <InlineError message={errorMessage(project.error ?? new Error("Project details are unavailable."))} onRetry={() => void project.refetch()} />
      ) : (
        <ProjectDetail key={`${project.data.provider}:${project.data.id}`} project={project.data} />
      )}
    </InspectorPanel>
  );
}

function ProjectDetail({ project }: { project: UnifiedProject }) {
  const client = useQueryClient();
  const [deploying, setDeploying] = useState(false);
  const deployLatest = async () => {
    setDeploying(true);
    try {
      if (project.provider === "vercel") {
        await window.deployDeck.vercel.deployLatest(project.id);
      } else {
        await window.deployDeck.cloudflare.createPagesDeployment(project.accountId, project.name);
      }
      toast.success("Deployment started");
      await client.invalidateQueries({ queryKey: ["deployments"] });
      await client.invalidateQueries({ queryKey: ["project-deployments"] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
      <TabsList aria-label="Project details" className="shrink-0 overflow-x-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="deployments">Deployments</TabsTrigger>
        <TabsTrigger value="domains">Domains</TabsTrigger>
        <TabsTrigger value="environment">Environment</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="overflow-auto p-3">
        <dl className="divide-y divide-line/70 text-[12px]">
          <DetailRow label="Framework" value={project.framework ?? "—"} />
          <DetailRow label="Production branch" value={project.productionBranch ?? "—"} mono />
          <DetailRow label="Root directory" value={project.rootDirectory ?? "—"} mono />
          <DetailRow label="Build command" value={project.buildCommand ?? "—"} mono />
          <DetailRow label="Output directory" value={project.outputDirectory ?? "—"} mono />
          <DetailRow label="Repository" value={project.repository ?? "—"} />
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" loading={deploying} onClick={() => void deployLatest()}>
            Deploy latest
          </Button>
          {project.repositoryUrl ? (
            <Button size="sm" variant="secondary" onClick={() => void window.deployDeck.shell.openHttps(project.repositoryUrl!)}>
              Open repository
              <ExternalLink aria-hidden />
            </Button>
          ) : null}
        </div>
      </TabsContent>

      <TabsContent value="deployments" className="overflow-auto">
        <ProjectDeployments project={project} />
      </TabsContent>
      <TabsContent value="domains" className="overflow-auto">
        <ProjectDomains project={project} />
      </TabsContent>
      <TabsContent value="environment" className="overflow-auto">
        <ProjectEnv project={project} />
      </TabsContent>
      <TabsContent value="settings" className="overflow-auto p-3">
        <p className="max-w-[52ch] text-[12px] leading-5 text-muted">
          This view shows the provider configuration DeployDeck uses. Advanced project settings remain in the provider dashboard.
        </p>
        <dl className="mt-3 divide-y divide-line/70 text-[12px]">
          <DetailRow label="Production URL" value={project.productionUrl ?? "—"} />
          <DetailRow label="Domains" value={project.domains.join(", ") || "—"} />
        </dl>
      </TabsContent>
    </Tabs>
  );
}

function ProjectDeployments({ project }: { project: UnifiedProject }) {
  const openDeployment = useUiStore((state) => state.openDeployment);
  const query = useQuery({
    queryKey: ["project-deployments", project.provider, project.id],
    queryFn: async () => {
      if (project.provider === "vercel") {
        return window.deployDeck.vercel.listDeployments({ projectId: project.id, limit: 20 });
      }
      return window.deployDeck.cloudflare.listPagesDeployments({
        accountId: project.accountId,
        projectName: project.name,
        limit: 20,
      });
    },
  });

  if (query.isLoading) return <PanelLoading />;
  if (query.isError) return <InlineError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;

  const items = query.data?.items ?? [];
  return (
    <div className="p-3">
      {items.length === 0 ? (
        <PanelMessage>No deployments are available for this project.</PanelMessage>
      ) : (
        <div className="divide-y divide-line/70">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              className={cn(
                "-mx-2 flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left",
                "transition-colors duration-150 ease-[var(--ease-out-expo)] motion-reduce:transition-none",
                "hover:bg-surface focus-visible:bg-surface focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              )}
              onClick={() => openDeployment(item)}
            >
              <StatusBadge state={item.state} />
              <span className="min-w-0 flex-1 truncate text-[12px]">{item.commitMessage ?? item.id}</span>
              <span className="shrink-0 text-[11px] text-muted tabular">{formatWhen(item.createdAt, "relative")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectDomains({ project }: { project: UnifiedProject }) {
  const client = useQueryClient();
  const ask = useUiStore((state) => state.askConfirm);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ["project-domains", project.provider, project.id],
    queryFn: () =>
      project.provider === "vercel"
        ? window.deployDeck.vercel.listDomains(project.id)
        : window.deployDeck.cloudflare.listPagesDomains(project.accountId, project.name),
  });

  const addDomain = async (event: FormEvent) => {
    event.preventDefault();
    const domain = name.trim();
    if (!domain || pending) return;
    setPending(true);
    try {
      if (project.provider === "vercel") await window.deployDeck.vercel.addDomain(project.id, domain);
      else await window.deployDeck.cloudflare.addPagesDomain(project.accountId, project.name, domain);
      toast.success("Domain added");
      setName("");
      await client.invalidateQueries({ queryKey: ["project-domains"] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <form className="flex gap-2" onSubmit={(event) => void addDomain(event)}>
        <Input
          type="text"
          aria-label="Domain name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="example.com"
          autoCapitalize="none"
          spellCheck={false}
        />
        <Button size="sm" type="submit" loading={pending} disabled={!name.trim()}>
          Add domain
        </Button>
      </form>

      {query.isLoading ? (
        <PanelLoading compact />
      ) : query.isError ? (
        <InlineError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <PanelMessage>No domains are attached to this project.</PanelMessage>
      ) : (
        <div className="divide-y divide-line/70 border-t border-line">
          {(query.data ?? []).map((domain) => (
            <div key={domain.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-[12px]">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium select-text">{domain.name}</p>
                <p className="mt-0.5 text-[11px] text-muted">{domain.status}</p>
                {!domain.verified && domain.verificationRecords.length > 0 ? (
                  <VerificationRecords records={domain.verificationRecords} compact />
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => void window.deployDeck.shell.openHttps(`https://${domain.name}`)}>
                  Open
                </Button>
                {project.provider === "vercel" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await window.deployDeck.vercel.verifyDomain(project.id, domain.name);
                        toast.success("Verification requested");
                        await client.invalidateQueries({ queryKey: ["project-domains"] });
                      } catch (error) {
                        toast.error(errorMessage(error));
                      }
                    }}
                  >
                    Verify
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await window.deployDeck.cloudflare.retryPagesDomain(project.accountId, project.name, domain.name);
                        toast.success("Verification retried");
                        await client.invalidateQueries({ queryKey: ["project-domains"] });
                      } catch (error) {
                        toast.error(errorMessage(error));
                      }
                    }}
                  >
                    Retry
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-failed hover:bg-failed-soft"
                  onClick={() =>
                    ask({
                      title: "Remove domain",
                      body: `${domain.name} will be detached from ${project.name}.`,
                      actionLabel: "Remove",
                      intent: "danger",
                      onConfirm: async () => {
                        if (project.provider === "vercel") {
                          await window.deployDeck.vercel.removeDomain(project.id, domain.name);
                        } else {
                          await window.deployDeck.cloudflare.removePagesDomain(project.accountId, project.name, domain.name);
                        }
                        await client.invalidateQueries({ queryKey: ["project-domains"] });
                        toast.success("Domain removed");
                      },
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectEnv({ project }: { project: UnifiedProject }) {
  const client = useQueryClient();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [branch, setBranch] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [target, setTarget] = useState<"production" | "preview" | "development">("production");
  const [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ["project-env", project.provider, project.id, target],
    queryFn: () =>
      project.provider === "vercel"
        ? window.deployDeck.vercel.listEnvVars(project.id)
        : window.deployDeck.cloudflare.listPagesEnv(project.accountId, project.name, target === "preview" ? "preview" : "production"),
  });
  const targetOptions = [
    { value: "production", label: "Production" },
    { value: "preview", label: "Preview" },
    ...(project.provider === "vercel" ? [{ value: "development", label: "Development" }] : []),
  ];

  const saveVariable = async (event: FormEvent) => {
    event.preventDefault();
    const variableKey = key.trim();
    if (!variableKey || !value || pending) return;
    setPending(true);
    try {
      if (project.provider === "vercel") {
        const input = { key: variableKey, value, targets: [target], type: "encrypted" as const, branch: branch.trim() || undefined };
        if (editingId) await window.deployDeck.vercel.updateEnvVar(project.id, editingId, input);
        else await window.deployDeck.vercel.createEnvVar(project.id, input);
      } else {
        await window.deployDeck.cloudflare.upsertPagesEnv({
          accountId: project.accountId,
          projectName: project.name,
          environment: target === "preview" ? "preview" : "production",
          name: variableKey,
          value,
        });
      }
      toast.success(editingId ? "Variable updated" : "Variable saved");
      setKey("");
      setValue("");
      setBranch("");
      setEditingId(undefined);
      await client.invalidateQueries({ queryKey: ["project-env"] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <form className="space-y-2" onSubmit={(event) => void saveVariable(event)}>
        <div className="grid grid-cols-2 gap-2">
          <Input
            aria-label="Environment variable key"
            placeholder="KEY"
            className="font-mono"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            autoCapitalize="none"
            spellCheck={false}
          />
          <Input
            aria-label="Environment variable value"
            placeholder="Value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        {project.provider === "vercel" ? (
          <Input
            aria-label="Git branch"
            placeholder="Branch (optional)"
            className="font-mono"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            autoCapitalize="none"
            spellCheck={false}
          />
        ) : null}
        <div className="flex items-center gap-2">
          <SelectControl
            ariaLabel="Environment target"
            className="w-40"
            value={target}
            onValueChange={(next) => setTarget(next as typeof target)}
            options={targetOptions}
          />
          <Button size="sm" type="submit" loading={pending} disabled={!key.trim() || !value}>
            {editingId ? "Update variable" : "Save variable"}
          </Button>
          {editingId ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingId(undefined);
                setKey("");
                setValue("");
                setBranch("");
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {query.isLoading ? (
        <PanelLoading compact />
      ) : query.isError ? (
        <InlineError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <PanelMessage>No variables exist for this target.</PanelMessage>
      ) : (
        <div className="divide-y divide-line/70 border-t border-line">
          {(query.data ?? []).map((item) => (
            <EnvRow
              key={item.id}
              item={item}
              onEdit={() => {
                setEditingId(item.id);
                setKey(item.key);
                setValue(item.value ?? "");
                setBranch(item.branch ?? "");
                setTarget((item.targets[0] as typeof target) || "production");
              }}
              onDelete={async () => {
                if (project.provider === "vercel") await window.deployDeck.vercel.deleteEnvVar(project.id, item.id);
                else {
                  await window.deployDeck.cloudflare.deletePagesEnv(
                    project.accountId,
                    project.name,
                    target === "preview" ? "preview" : "production",
                    item.key,
                  );
                }
                await client.invalidateQueries({ queryKey: ["project-env"] });
                toast.success("Variable deleted");
              }}
              onReveal={
                project.provider === "vercel"
                  ? () => window.deployDeck.vercel.revealEnvVar(project.id, item.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EnvRow({
  item,
  onDelete,
  onEdit,
  onReveal,
}: {
  item: EnvironmentVariable;
  onDelete: () => Promise<void>;
  onEdit?: () => void;
  onReveal?: () => Promise<string>;
}) {
  const [revealed, setRevealed] = useState<string>();
  const ask = useUiStore((state) => state.askConfirm);

  return (
    <div className="flex min-h-12 items-center justify-between gap-3 py-2 text-[12px]">
      <div className="min-w-0 select-text">
        <p className="truncate font-mono font-medium">{item.key}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted">
          {item.type} · {item.targets.join(", ")}
          {item.branch ? ` · ${item.branch}` : ""}
        </p>
        <p className="mt-0.5 truncate font-mono text-[11px]">{revealed ?? item.value ?? "••••••"}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        {onEdit ? (
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
        {onReveal ? (
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={Boolean(revealed)}
            onClick={async () => {
              if (revealed) {
                setRevealed(undefined);
                return;
              }
              try {
                setRevealed(await onReveal());
              } catch (error) {
                toast.error(errorMessage(error));
              }
            }}
          >
            {revealed ? "Hide" : "Reveal"}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="text-failed hover:bg-failed-soft"
          onClick={() =>
            ask({
              title: "Delete variable",
              body: `${item.key} will be permanently removed.`,
              actionLabel: "Delete",
              intent: "danger",
              onConfirm: onDelete,
            })
          }
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

function WorkerDetail({ accountId, name }: { accountId: string; name: string }) {
  const client = useQueryClient();
  const prefs = usePrefs();
  const versions = useQuery({
    queryKey: ["worker-versions", accountId, name],
    queryFn: () => window.deployDeck.cloudflare.listWorkerVersions(accountId, name),
  });
  const deployments = useQuery({
    queryKey: ["worker-deployments", accountId, name],
    queryFn: () => window.deployDeck.cloudflare.listWorkerDeployments(accountId, name),
  });
  const vars = useQuery({
    queryKey: ["worker-vars", accountId, name],
    queryFn: () => window.deployDeck.cloudflare.listWorkerVars(accountId, name),
  });
  const secrets = useQuery({
    queryKey: ["worker-secrets", accountId, name],
    queryFn: () => window.deployDeck.cloudflare.listWorkerSecrets(accountId, name),
  });
  const ask = useUiStore((state) => state.askConfirm);
  const [varName, setVarName] = useState("");
  const [varValue, setVarValue] = useState("");
  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [savingVar, setSavingVar] = useState(false);
  const [savingSecret, setSavingSecret] = useState(false);
  const [percent, setPercent] = useState("100");
  const timeFormat = prefs.data?.timeFormat ?? "relative";
  const activeVersion = (versions.data ?? []).find((version) => (version.trafficPercent ?? 0) > 0);

  const saveWorkerVar = async (event: FormEvent) => {
    event.preventDefault();
    const key = varName.trim();
    if (!key || !varValue || savingVar) return;
    setSavingVar(true);
    try {
      await window.deployDeck.cloudflare.upsertWorkerVar(accountId, name, key, varValue);
      setVarName("");
      setVarValue("");
      await client.invalidateQueries({ queryKey: ["worker-vars", accountId, name] });
      toast.success("Worker variable saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingVar(false);
    }
  };

  const saveWorkerSecret = async (event: FormEvent) => {
    event.preventDefault();
    const key = secretName.trim();
    if (!key || !secretValue || savingSecret) return;
    setSavingSecret(true);
    try {
      await window.deployDeck.cloudflare.putWorkerSecret(accountId, name, key, secretValue);
      setSecretName("");
      setSecretValue("");
      await client.invalidateQueries({ queryKey: ["worker-secrets", accountId, name] });
      toast.success("Worker secret saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingSecret(false);
    }
  };

  return (
    <Tabs defaultValue="versions" className="flex min-h-0 flex-1 flex-col">
      <TabsList aria-label="Worker details" className="shrink-0 overflow-x-auto">
        <TabsTrigger value="versions">Versions</TabsTrigger>
        <TabsTrigger value="deployments">Deployments</TabsTrigger>
        <TabsTrigger value="routes">Routes</TabsTrigger>
        <TabsTrigger value="domains">Domains</TabsTrigger>
        <TabsTrigger value="variables">Variables</TabsTrigger>
        <TabsTrigger value="secrets">Secrets</TabsTrigger>
      </TabsList>

      <TabsContent value="versions" className="overflow-auto p-3">
        {versions.isLoading ? (
          <PanelLoading compact />
        ) : versions.isError ? (
          <InlineError message={errorMessage(versions.error)} onRetry={() => void versions.refetch()} />
        ) : (versions.data ?? []).length === 0 ? (
          <PanelMessage>No Worker versions are available.</PanelMessage>
        ) : (
          <div className="divide-y divide-line/70">
            {(versions.data ?? []).map((version) => (
              <div key={version.id} className="flex min-h-10 items-center justify-between gap-3 py-2 text-[12px]">
                <div className="min-w-0">
                  <p className="truncate font-mono select-text">{version.id.slice(0, 12)}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {version.trafficPercent !== undefined ? `${version.trafficPercent}% traffic` : "No active traffic"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <SelectControl
                    ariaLabel={`Traffic percent for ${version.id}`}
                    className="w-20"
                    size="sm"
                    value={percent}
                    onValueChange={setPercent}
                    options={[
                      { value: "10", label: "10%" },
                      { value: "25", label: "25%" },
                      { value: "50", label: "50%" },
                      { value: "100", label: "100%" },
                    ]}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      ask({
                        title: `Deploy this version at ${percent}%`,
                        body: `${name} · ${version.id}`,
                        actionLabel: "Deploy",
                        intent: "default",
                        onConfirm: async () => {
                          const share = Number(percent);
                          await window.deployDeck.cloudflare.deployWorkerVersion(
                            accountId,
                            name,
                            version.id,
                            share,
                            share < 100 ? activeVersion?.id : undefined,
                          );
                          await client.invalidateQueries({ queryKey: ["worker-deployments", accountId, name] });
                          await client.invalidateQueries({ queryKey: ["worker-versions", accountId, name] });
                          toast.success("Worker version deployed");
                        },
                      })
                    }
                  >
                    Deploy
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="deployments" className="overflow-auto p-3">
        {deployments.isLoading ? (
          <PanelLoading compact />
        ) : deployments.isError ? (
          <InlineError message={errorMessage(deployments.error)} onRetry={() => void deployments.refetch()} />
        ) : (deployments.data ?? []).length === 0 ? (
          <PanelMessage>No Worker deployments are available.</PanelMessage>
        ) : (
          <div className="divide-y divide-line/70">
            {(deployments.data ?? []).map((item) => (
              <div key={item.id} className="flex min-h-10 items-center justify-between gap-3 py-2 text-[12px]">
                <div className="min-w-0">
                  <p className="truncate font-mono select-text">{item.id.slice(0, 12)}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {formatWhen(item.createdOn, timeFormat)} · {item.source ?? "unknown source"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    ask({
                      title: "Restore this Worker deployment",
                      body: item.id,
                      actionLabel: "Restore",
                      intent: "warning",
                      onConfirm: async () => {
                        await window.deployDeck.cloudflare.restoreWorkerDeployment(accountId, name, item.id);
                        await client.invalidateQueries({ queryKey: ["worker-deployments", accountId, name] });
                        toast.success("Worker deployment restored");
                      },
                    })
                  }
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="routes" className="overflow-auto">
        <WorkerRoutesPanel accountId={accountId} name={name} />
      </TabsContent>
      <TabsContent value="domains" className="overflow-auto">
        <WorkerDomainsPanel accountId={accountId} name={name} />
      </TabsContent>
      <TabsContent value="variables" className="overflow-auto p-3">
        <form className="mb-3 space-y-2" onSubmit={(event) => void saveWorkerVar(event)}>
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label="Worker variable name"
              value={varName}
              onChange={(event) => setVarName(event.target.value)}
              placeholder="NAME"
              className="font-mono"
              autoCapitalize="none"
              spellCheck={false}
            />
            <Input
              aria-label="Worker variable value"
              value={varValue}
              onChange={(event) => setVarValue(event.target.value)}
              placeholder="Value"
            />
          </div>
          <Button size="sm" type="submit" loading={savingVar} disabled={!varName.trim() || !varValue}>
            Save variable
          </Button>
        </form>
        {vars.isLoading ? (
          <PanelLoading compact />
        ) : vars.isError ? (
          <InlineError message={errorMessage(vars.error)} onRetry={() => void vars.refetch()} />
        ) : (vars.data ?? []).length === 0 ? (
          <PanelMessage>No Worker variables are set.</PanelMessage>
        ) : (
          <div className="divide-y divide-line/70 border-t border-line">
            {(vars.data ?? []).map((item) => (
              <div key={item.id} className="flex min-h-10 items-center justify-between gap-3 py-2 text-[12px]">
                <span className="min-w-0 truncate font-mono select-text">{item.key}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-failed hover:bg-failed-soft"
                  onClick={() =>
                    ask({
                      title: "Delete Worker variable",
                      body: `${item.key} will be permanently removed.`,
                      actionLabel: "Delete",
                      intent: "danger",
                      onConfirm: async () => {
                        await window.deployDeck.cloudflare.deleteWorkerVar(accountId, name, item.key);
                        await client.invalidateQueries({ queryKey: ["worker-vars", accountId, name] });
                        toast.success("Worker variable deleted");
                      },
                    })
                  }
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="secrets" className="overflow-auto p-3">
        <form className="mb-3 space-y-2" onSubmit={(event) => void saveWorkerSecret(event)}>
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label="Worker secret name"
              value={secretName}
              onChange={(event) => setSecretName(event.target.value)}
              placeholder="SECRET"
              className="font-mono"
              autoCapitalize="none"
              spellCheck={false}
            />
            <Input
              type="password"
              aria-label="Worker secret value"
              value={secretValue}
              onChange={(event) => setSecretValue(event.target.value)}
              placeholder="Value"
              autoComplete="off"
            />
          </div>
          <Button size="sm" type="submit" loading={savingSecret} disabled={!secretName.trim() || !secretValue}>
            Save secret
          </Button>
        </form>
        {secrets.isLoading ? (
          <PanelLoading compact />
        ) : secrets.isError ? (
          <InlineError message={errorMessage(secrets.error)} onRetry={() => void secrets.refetch()} />
        ) : (secrets.data ?? []).length === 0 ? (
          <PanelMessage>No Worker secrets are set.</PanelMessage>
        ) : (
          <div className="divide-y divide-line/70 border-t border-line">
            {(secrets.data ?? []).map((item) => (
              <div key={item.id} className="flex min-h-10 items-center justify-between gap-3 py-2 text-[12px]">
                <div className="min-w-0">
                  <p className="truncate font-mono">{item.key}</p>
                  <p className="mt-0.5 text-[11px] text-muted">Permanently masked</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-failed hover:bg-failed-soft"
                  onClick={() =>
                    ask({
                      title: "Delete Worker secret",
                      body: `${item.key} will be permanently removed.`,
                      actionLabel: "Delete",
                      intent: "danger",
                      onConfirm: async () => {
                        await window.deployDeck.cloudflare.deleteWorkerSecret(accountId, name, item.key);
                        await client.invalidateQueries({ queryKey: ["worker-secrets", accountId, name] });
                        toast.success("Worker secret deleted");
                      },
                    })
                  }
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function PanelLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("space-y-2", compact ? "py-2" : "p-3")} aria-label="Loading">
      {Array.from({ length: compact ? 3 : 5 }).map((_, index) => (
        <Skeleton key={index} className="h-8" />
      ))}
    </div>
  );
}

function PanelMessage({ children }: { children: string }) {
  return <EmptyState size="inline" title={children} />;
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <ScreenError size="inline" message={message} onRetry={onRetry} />;
}
