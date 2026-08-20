import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Popover from "@radix-ui/react-popover";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Download, ExternalLink, Pause, Play, Search, SlidersHorizontal, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { EnvironmentVariable, LocalSourceHandle, UnifiedProject, WorkerScript } from "@shared/models";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { DomainVerification } from "@/components/domains/domain-verification";
import { WorkerTailPanel } from "@/components/logs/worker-tail";
import { ProviderMark, StatusBadge } from "@/components/common/status-badge";
import { DetailRow, InspectorHeader, InspectorPanel, ResourceListFrame, ScreenToolbar } from "@/components/ui/layout";
import { Panel, PanelRowButton } from "@/components/ui/panel";
import {
  Button,
  Input,
  SelectControl,
  Skeleton,
  SwitchControl,
  TableSkeleton,
  Textarea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives";
import { useConnection, usePrefs } from "@/hooks/use-connection";
import { useProjects, useZones } from "@/hooks/use-data";
import { cn } from "@/lib/cn";
import { errorMessage, formatWhen, providerLabel } from "@/lib/format";
import { envChangeNeedsRedeploy, redeployProduction } from "@/lib/redeploy";
import { useUiStore } from "@/stores/ui-store";
import { toast } from "sonner";

type ProviderFilter = "all" | "vercel" | "cloudflare-pages" | "cloudflare-workers";

interface WorkerSelection {
  kind: "worker";
  accountId: string;
  name: string;
  accountName: string;
}

type ProjectSelection = UnifiedProject | WorkerSelection;

type ProjectTableEntry =
  | { kind: "project"; key: string; item: UnifiedProject }
  | { kind: "worker"; key: string; item: WorkerScript };

const PROVIDER_OPTIONS = [
  { value: "all", label: "All providers" },
  { value: "vercel", label: "Vercel" },
  { value: "cloudflare-pages", label: "Cloudflare Pages" },
  { value: "cloudflare-workers", label: "Cloudflare Workers" },
] as const;

const projectSettingsSchema = z.object({
  name: z.string().trim().min(1, "Project name is required."),
  productionBranch: z.string(),
  framework: z.string(),
  rootDirectory: z.string(),
  installCommand: z.string(),
  buildCommand: z.string(),
  outputDirectory: z.string(),
  buildCaching: z.boolean(),
});

type ProjectSettingsValues = z.infer<typeof projectSettingsSchema>;

export function ProjectsScreen() {
  const connection = useConnection();
  const projects = useProjects();
  const prefs = usePrefs();
  const [provider, setProvider] = useState<ProviderFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ProjectSelection>();
  const projectFocus = useUiStore((state) => state.projectFocus);
  const normalizedQuery = query.trim().toLowerCase();
  const canVercel = Boolean(connection.data?.vercel.connected);
  const canPages = Boolean(
    connection.data?.cloudflare.connected && (connection.data.cloudflare.capabilities?.pages ?? true),
  );
  const canWorkers = Boolean(
    connection.data?.cloudflare.connected && (connection.data.cloudflare.capabilities?.workers ?? true),
  );
  const providerOptions = PROVIDER_OPTIONS.filter((option) => {
    if (option.value === "vercel") return canVercel;
    if (option.value === "cloudflare-pages") return canPages;
    if (option.value === "cloudflare-workers") return canWorkers;
    return true;
  });

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

  useEffect(() => {
    if (!projectFocus || !projects.data) return;
    if (projectFocus.kind === "worker") {
      const worker = (projects.data.workers ?? []).find(
        (item) => item.accountId === projectFocus.accountId && item.name === projectFocus.name,
      );
      if (!worker) return;
      setProvider((current) => (current === "all" || current === "cloudflare-workers" ? current : "cloudflare-workers"));
      setSelected({
        kind: "worker",
        accountId: worker.accountId,
        accountName: worker.accountName,
        name: worker.name,
      });
      return;
    }
    const match = [...(projects.data.vercel ?? []), ...(projects.data.pages ?? [])].find(
      (item) => item.provider === projectFocus.provider && item.id === projectFocus.id,
    );
    if (!match) return;
    setProvider((current) => (current === "all" || current === match.provider ? current : match.provider));
    setSelected(match);
  }, [projectFocus, projects.data]);
  useEffect(() => {
    if (
      (provider === "vercel" && !canVercel) ||
      (provider === "cloudflare-pages" && !canPages) ||
      (provider === "cloudflare-workers" && !canWorkers)
    ) {
      setProvider("all");
    }
  }, [canPages, canVercel, canWorkers, provider]);
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
        <ResourceListFrame>
        <Panel className="min-h-0 flex-1">
        <ScreenToolbar role="search" aria-label="Filter projects and workers">
          <div className="relative w-72">
            {/* Matches the Deployments search field, which had the icon and
                this one did not. */}
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
              strokeWidth={1.75}
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Search projects and workers"
              placeholder="Search projects and workers"
              className="pl-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="contents max-[1479px]:hidden">
            <SelectControl ariaLabel="Filter by provider" className="w-44" value={provider} onValueChange={(value) => setProvider(value as ProviderFilter)} options={providerOptions} />
            {hasFilters ? <Button variant="ghost" size="sm" className="text-muted" onClick={clearFilters}>Reset filters</Button> : null}
          </div>
          <Popover.Root>
            <Popover.Trigger asChild><Button size="sm" variant="outline" className="min-[1480px]:hidden"><SlidersHorizontal aria-hidden /> Filters{hasFilters ? " · active" : ""}</Button></Popover.Trigger>
            <Popover.Portal><Popover.Content align="start" sideOffset={6} collisionPadding={8} className="z-[var(--z-dropdown)] w-64 space-y-3 rounded-panel bg-panel p-3 shadow-[var(--shadow-popover)]">
              <SelectControl ariaLabel="Filter by provider" className="w-full" value={provider} onValueChange={(value) => setProvider(value as ProviderFilter)} options={providerOptions} />
              {hasFilters ? <Button variant="ghost" size="sm" className="w-full justify-start text-muted" onClick={clearFilters}>Reset filters</Button> : null}
            </Popover.Content></Popover.Portal>
          </Popover.Root>
          <span className="ml-auto text-dense text-muted tabular" aria-live="polite">
            {projects.isLoading
              ? "Loading projects…"
              : projects.isFetching
                ? "Updating…"
                : `${entries.length} shown`}
          </span>
        </ScreenToolbar>

        {projects.isLoading ? (
          <TableSkeleton columns={6} rows={10} label="Loading projects" />
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
            onSelect={setSelected}
            showProviderIcons={prefs.data?.showProviderIcons}
            timeFormat={prefs.data?.timeFormat ?? "relative"}
          />
        )}
        </Panel>
        </ResourceListFrame>
      </div>

      {selected ? <ProjectInspector selected={selected} onClose={() => setSelected(undefined)} /> : null}
    </div>
  );
}

function ProjectsTable({
  entries,
  selected,
  onSelect,
  showProviderIcons,
  timeFormat,
}: {
  entries: ProjectTableEntry[];
  selected?: ProjectSelection;
  onSelect: (selection: ProjectSelection) => void;
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
    if (entry.kind === "project") {
      useUiStore.getState().openProject({ kind: "project", provider: entry.item.provider, id: entry.item.id });
      onSelect(entry.item);
    } else {
      useUiStore.getState().openProject({
        kind: "worker",
        accountId: entry.item.accountId,
        name: entry.item.name,
      });
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
      <table className="data-table data-table-fixed min-w-[900px]" aria-label="Projects and workers">
        <colgroup>
          <col style={{ width: 116 }} />
          <col />
          <col style={{ width: 176 }} />
          <col style={{ width: 156 }} />
          <col style={{ width: 148 }} />
          <col style={{ width: 128 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Name</th>
            <th>Account</th>
            <th>Production branch</th>
            <th>State or version</th>
            <th data-numeric>Updated</th>
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
                onClick={(event) => {
                  event.currentTarget.focus();
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
                <td className="truncate">
                  <ProviderMark
                    provider={entry.kind === "project" ? entry.item.provider : "cloudflare-workers"}
                    showIcon={showProviderIcons}
                  />
                </td>
                <td className="truncate font-medium text-ink">{item.name}</td>
                <td className="truncate text-muted">{item.accountName}</td>
                <td className="truncate font-mono text-dense">
                  {entry.kind === "project" ? entry.item.productionBranch ?? "—" : "—"}
                </td>
                <td>
                  {entry.kind === "project" ? (
                    entry.item.latestDeploymentState ? <StatusBadge state={entry.item.latestDeploymentState} /> : "—"
                  ) : entry.item.activeVersionId ? (
                    <span className="font-mono text-dense">{entry.item.activeVersionId.slice(0, 8)}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td data-numeric className="text-muted">
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

function selectionKey(selection?: ProjectSelection): string | undefined {
  if (!selection) return undefined;
  if ("kind" in selection) return `worker:${selection.accountId}:${selection.name}`;
  return `${selection.provider}:${selection.id}`;
}

function ProjectInspector({ selected, onClose }: { selected: ProjectSelection; onClose: () => void }) {
  const worker = "kind" in selected;
  const title = selected.name;
  const subtitle = worker
    ? `${selected.accountName} · Cloudflare Workers`
    : `${selected.accountName} · ${providerLabel(selected.provider)}`;
  const dashboardUrl = worker
    ? `https://dash.cloudflare.com/${selected.accountId}/workers/services/view/${selected.name}`
    : selected.dashboardUrl;

  return (
    <InspectorPanel size="md" className="deployment-inspector" onDismiss={onClose} aria-label={`${title} inspector`}>
      <InspectorHeader
        title={title}
        subtitle={subtitle}
        closeLabel={`Close ${title} inspector`}
        onClose={onClose}
        actions={
          <Button size="sm" variant="secondary" onClick={() => void window.deployDeck.shell.openHttps(dashboardUrl)}>
            Dashboard
            <ExternalLink aria-hidden />
          </Button>
        }
      />
      {worker ? (
        <WorkerDetail key={`worker:${selected.accountId}:${selected.name}`} accountId={selected.accountId} name={selected.name} onClose={onClose} />
      ) : (
        <ProjectDetail key={`${selected.provider}:${selected.id}`} project={selected} onClose={onClose} />
      )}
    </InspectorPanel>
  );
}

function ProjectDetail({ project, onClose }: { project: UnifiedProject; onClose: () => void }) {
  return (
    <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
      <TabsList aria-label="Project details" className="shrink-0 overflow-x-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="deployments">Deployments</TabsTrigger>
        <TabsTrigger value="domains">Domains</TabsTrigger>
        <TabsTrigger value="environment">Environment</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="overflow-auto p-4">
        <dl className="divide-y divide-line/70">
          <DetailRow label="Framework" value={project.framework ?? "—"} />
          <DetailRow label="Production branch" value={project.productionBranch ?? "—"} mono />
          <DetailRow label="Root directory" value={project.rootDirectory ?? "—"} mono />
          <DetailRow label="Install command" value={project.installCommand ?? "—"} mono />
          <DetailRow label="Build command" value={project.buildCommand ?? "—"} mono />
          <DetailRow label="Output directory" value={project.outputDirectory ?? "—"} mono />
          <DetailRow label="Repository" value={project.repository ?? "—"} />
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          {project.repositoryUrl ? (
            <Button size="sm" variant="secondary" onClick={() => void window.deployDeck.shell.openHttps(project.repositoryUrl!)}>
              Open repository
              <ExternalLink aria-hidden />
            </Button>
          ) : null}
          <RedeployProductionButton project={project} />
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
      <TabsContent value="settings" className="overflow-auto p-4">
        <ProjectSettings project={project} onDeleted={onClose} />
      </TabsContent>
    </Tabs>
  );
}

function ProjectSettings({ project, onDeleted }: { project: UnifiedProject; onDeleted: () => void }) {
  const client = useQueryClient();
  const connection = useConnection();
  const ask = useUiStore((state) => state.askConfirm);
  const setScreen = useUiStore((state) => state.setScreen);
  const [confirmName, setConfirmName] = useState("");
  const form = useForm<ProjectSettingsValues>({
    resolver: zodResolver(projectSettingsSchema),
    defaultValues: {
      name: project.name,
      productionBranch: project.productionBranch ?? "main",
      framework: project.framework ?? "",
      rootDirectory: project.rootDirectory ?? "",
      installCommand: project.installCommand ?? "",
      buildCommand: project.buildCommand ?? "",
      outputDirectory: project.outputDirectory ?? "",
      buildCaching: true,
    },
  });
  const buildCaching = form.watch("buildCaching");
  const canWrite = project.provider === "vercel"
    ? Boolean(connection.data?.vercel.connected)
    : Boolean(connection.data?.cloudflare.capabilities?.pagesWrite);

  const save = async (values: ProjectSettingsValues) => {
    try {
      const patch = {
        name: values.name,
        productionBranch: values.productionBranch.trim() || undefined,
        framework: values.framework.trim() || undefined,
        rootDirectory: values.rootDirectory.trim() || undefined,
        installCommand: values.installCommand.trim() || undefined,
        buildCommand: values.buildCommand.trim() || undefined,
        outputDirectory: values.outputDirectory.trim() || undefined,
        buildCaching: values.buildCaching,
      };
      if (project.provider === "vercel") await window.deployDeck.vercel.updateProject(project.id, patch);
      else await window.deployDeck.cloudflare.updatePagesProject(project.accountId, project.name, patch);
      await client.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project settings saved");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const togglePause = async () => {
    try {
      if (project.paused) await window.deployDeck.vercel.resumeProject(project.id);
      else await window.deployDeck.vercel.pauseProject(project.id);
      await client.invalidateQueries({ queryKey: ["projects"] });
      toast.success(project.paused ? "Project resumed" : "Project paused");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = () => ask({
    title: `Delete ${project.name}`,
    body: "Deployments, domains, environment variables, and provider settings owned by this project will also be removed.",
    actionLabel: "Delete project",
    intent: "danger",
    onConfirm: async () => {
      if (project.provider === "vercel") await window.deployDeck.vercel.deleteProject(project.id);
      else await window.deployDeck.cloudflare.deletePagesProject(project.accountId, project.name);
      await client.invalidateQueries({ queryKey: ["projects"] });
      onDeleted();
      toast.success("Project deleted");
    },
  });

  return (
    <div className="space-y-5">
      {!canWrite ? (
        <div className="flex items-center justify-between gap-3 rounded-control bg-warning-soft px-3 py-2 text-dense text-warning-ink">
          <span>Read access is available, but project changes require a write-capable connection.</span>
          <Button size="sm" variant="secondary" onClick={() => setScreen("settings")}>Reconnect</Button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <ProjectField label="Project name" className="col-span-2"><Input {...form.register("name")} aria-invalid={Boolean(form.formState.errors.name)} /></ProjectField>
        <ProjectField label="Production branch"><Input {...form.register("productionBranch")} /></ProjectField>
        <ProjectField label="Framework"><Input {...form.register("framework")} placeholder="Auto detect" /></ProjectField>
        <ProjectField label="Root directory"><Input {...form.register("rootDirectory")} placeholder="Project root" /></ProjectField>
        <ProjectField label="Install command"><Input {...form.register("installCommand")} placeholder="Provider default" /></ProjectField>
        <ProjectField label="Build command"><Input {...form.register("buildCommand")} placeholder="Auto detect" /></ProjectField>
        <ProjectField label="Output directory" className="col-span-2"><Input {...form.register("outputDirectory")} placeholder="Auto detect" /></ProjectField>
        {project.provider === "cloudflare-pages" ? (
          <label className="col-span-2 flex items-center justify-between rounded-control border border-line bg-surface px-3 py-2 text-dense text-ink">
            Build cache
            <SwitchControl checked={buildCaching} onCheckedChange={(checked) => form.setValue("buildCaching", checked, { shouldDirty: true })} ariaLabel="Enable Pages build cache" />
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={form.formState.isSubmitting} disabled={!canWrite} onClick={() => void form.handleSubmit(save)()}>Save settings</Button>
        {project.provider === "vercel" ? (
          <Button size="sm" variant="secondary" disabled={!canWrite} onClick={() => void togglePause()}>{project.paused ? <Play aria-hidden /> : <Pause aria-hidden />}{project.paused ? "Resume project" : "Pause project"}</Button>
        ) : (
          <Button size="sm" variant="secondary" disabled={!canWrite} onClick={async () => {
            try { await window.deployDeck.cloudflare.purgePagesBuildCache(project.accountId, project.name); toast.success("Build cache purged"); }
            catch (error) { toast.error(errorMessage(error)); }
          }}>Purge build cache</Button>
        )}
      </div>
      <div className="rounded-panel border border-failed-ink/25 bg-failed-soft p-3">
        <h3 className="text-body font-semibold text-failed-ink">Danger zone</h3>
        <p className="mt-1 text-dense text-failed-ink">Type <strong>{project.name}</strong> to enable permanent deletion.</p>
        <div className="mt-3 flex gap-2">
          <Input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} placeholder={project.name} aria-label="Confirm project name" />
          <Button size="sm" variant="danger" disabled={!canWrite || confirmName !== project.name} onClick={remove}><Trash2 aria-hidden /> Delete</Button>
        </div>
      </div>
    </div>
  );
}

function ProjectField({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={cn("space-y-1.5 text-label font-medium text-muted", className)}><span className="block">{label}</span>{children}</label>;
}

function RedeployProductionButton({ project }: { project: UnifiedProject }) {
  const client = useQueryClient();
  const ask = useUiStore((state) => state.askConfirm);
  const [pending, setPending] = useState(false);

  const run = async () => {
    setPending(true);
    try {
      await redeployProduction(project);
      toast.success("Production redeploy started");
      await client.invalidateQueries({ queryKey: ["deployments"] });
      await client.invalidateQueries({ queryKey: ["project-deployments", project.provider, project.id] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        ask({
          title: "Redeploy production",
          body: `${project.name} will start a new production deployment from the latest ready one.`,
          actionLabel: "Redeploy",
          onConfirm: () => run(),
        })
      }
    >
      Redeploy production
    </Button>
  );
}

function offerProductionRedeploy(project: UnifiedProject) {
  useUiStore.getState().askConfirm({
    title: "Redeploy production?",
    body: `${project.name} will pick up the new variable on the next production deployment.`,
    actionLabel: "Redeploy",
    onConfirm: async () => {
      try {
        await redeployProduction(project);
        toast.success("Production redeploy started");
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
  });
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
  if (items.length === 0) return <PanelMessage>No deployments are available for this project.</PanelMessage>;

  return (
    <InspectorList>
      {items.map((item) => (
        <PanelRowButton
          key={item.id}
          onClick={() => openDeployment(item)}
          aria-label={`Inspect deployment ${item.id}`}
          leading={<StatusBadge state={item.state} />}
          title={item.commitMessage ?? item.id}
          trailing={
            <time className="text-dense text-muted tabular" dateTime={item.createdAt}>
              {formatWhen(item.createdAt, "relative")}
            </time>
          }
        />
      ))}
    </InspectorList>
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
    <div>
      <InspectorBlock>
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
          <Button type="submit" loading={pending} disabled={!name.trim()}>
            Add domain
          </Button>
        </form>
      </InspectorBlock>

      {query.isLoading ? (
        <PanelLoading compact />
      ) : query.isError ? (
        <InlineError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <PanelMessage>No domains are attached to this project.</PanelMessage>
      ) : (
        <InspectorList>
          {(query.data ?? []).map((domain) => (
            <div key={domain.id} className="px-4 py-2">
              <div className="flex min-h-11 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-body font-medium select-text">{domain.name}</p>
                <p className="mt-0.5 truncate text-label text-muted">{domain.status}</p>
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
                  className="text-failed-ink hover:bg-failed-soft"
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
              <div className="pb-1">
                <DomainVerification
                  domain={domain}
                  onWritten={() => void client.invalidateQueries({ queryKey: ["dns-records"] })}
                />
              </div>
            </div>
          ))}
        </InspectorList>
      )}
    </div>
  );
}

function ProjectEnv({ project }: { project: UnifiedProject }) {
  const client = useQueryClient();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [target, setTarget] = useState<"production" | "preview" | "development">("production");
  const [branch, setBranch] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<EnvironmentVariable>();
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

  const resetEditor = () => {
    setKey("");
    setValue("");
    setBranch("");
    setEditing(undefined);
  };

  const beginEdit = async (item: EnvironmentVariable) => {
    setEditing(item);
    setKey(item.key);
    setBranch(item.branch ?? "");
    if (item.targets[0] === "preview" || item.targets[0] === "development" || item.targets[0] === "production") {
      setTarget(item.targets[0]);
    }
    if (item.value) {
      setValue(item.value);
      return;
    }
    if (project.provider === "vercel") {
      try {
        setValue(await window.deployDeck.vercel.revealEnvVar(project.id, item.id));
        return;
      } catch {
        // leave the value blank; the user can type a replacement
      }
    }
    setValue("");
  };

  const saveVariable = async (event: FormEvent) => {
    event.preventDefault();
    const variableKey = key.trim();
    if (!variableKey || !value || pending) return;
    setPending(true);
    try {
      if (project.provider === "vercel") {
        const input = { key: variableKey, value, targets: [target], type: "encrypted" as const, branch: branch.trim() || undefined };
        if (editing) await window.deployDeck.vercel.updateEnvVar(project.id, editing.id, input);
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
      toast.success(editing ? "Variable updated" : "Variable saved");
      resetEditor();
      await client.invalidateQueries({ queryKey: ["project-env"] });
      if (envChangeNeedsRedeploy(project.provider) && target === "production") {
        offerProductionRedeploy(project);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <InspectorBlock>
        <form className="space-y-2.5" onSubmit={(event) => void saveVariable(event)}>
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
          <div className="flex items-center gap-2">
            <SelectControl
              ariaLabel="Environment target"
              className="w-40"
              value={target}
              onValueChange={(next) => setTarget(next as typeof target)}
              options={targetOptions}
            />
            {project.provider === "vercel" ? (
              <Input
                aria-label="Git branch"
                placeholder="Branch (optional)"
                className="w-40 font-mono"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
              />
            ) : null}
            {editing ? (
              <Button variant="ghost" className="text-muted" type="button" onClick={resetEditor}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit" loading={pending} disabled={!key.trim() || !value}>
              {editing ? "Update variable" : "Save variable"}
            </Button>
          </div>
        </form>
      </InspectorBlock>

      {query.isLoading ? (
        <PanelLoading compact />
      ) : query.isError ? (
        <InlineError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <PanelMessage>No variables exist for this target.</PanelMessage>
      ) : (
        <InspectorList>
          {(query.data ?? []).map((item) => (
            <EnvRow
              key={item.id}
              item={item}
              editing={editing?.id === item.id}
              onEdit={() => void beginEdit(item)}
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
        </InspectorList>
      )}
    </div>
  );
}

function EnvRow({
  item,
  editing,
  onEdit,
  onDelete,
  onReveal,
}: {
  item: { id: string; key: string; type: string; targets: string[]; branch?: string; value?: string };
  editing?: boolean;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onReveal?: () => Promise<string>;
}) {
  const [revealed, setRevealed] = useState<string>();
  const ask = useUiStore((state) => state.askConfirm);

  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
      <div className="min-w-0 select-text">
        <p className="truncate font-mono text-body font-medium">{item.key}</p>
        <p className="mt-0.5 truncate text-label text-muted">
          {item.type} · {item.targets.join(", ")}
          {item.branch ? ` · ${item.branch}` : ""}
        </p>
        <p className="mt-0.5 truncate font-mono text-dense text-muted">{revealed ?? item.value ?? "••••••"}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" aria-pressed={editing || undefined} onClick={onEdit}>
          {editing ? "Editing" : "Edit"}
        </Button>
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
          className="text-failed-ink hover:bg-failed-soft"
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

function WorkerDetail({ accountId, name, onClose }: { accountId: string; name: string; onClose: () => void }) {
  const client = useQueryClient();
  const prefs = usePrefs();
  const connection = useConnection();
  const canRoutes = connection.data?.cloudflare.capabilities?.workerRoutes ?? true;
  const canTail = connection.data?.cloudflare.capabilities?.workerTail ?? true;
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
  const routes = useQuery({
    queryKey: ["worker-routes", accountId, name],
    enabled: canRoutes,
    queryFn: () => window.deployDeck.cloudflare.listWorkerRoutes(accountId, name),
  });
  const domains = useQuery({
    queryKey: ["worker-domains", accountId, name],
    queryFn: () => window.deployDeck.cloudflare.listWorkerDomains(accountId, name),
  });
  const zones = useZones();
  const ask = useUiStore((state) => state.askConfirm);
  const [varName, setVarName] = useState("");
  const [varValue, setVarValue] = useState("");
  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [savingVar, setSavingVar] = useState(false);
  const [savingSecret, setSavingSecret] = useState(false);
  const [deployShare, setDeployShare] = useState("100");
  const [routePattern, setRoutePattern] = useState("");
  const [routeZoneId, setRouteZoneId] = useState("");
  const [savingRoute, setSavingRoute] = useState(false);
  const [domainHost, setDomainHost] = useState("");
  const [domainZoneId, setDomainZoneId] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);
  const timeFormat = prefs.data?.timeFormat ?? "relative";
  const zoneOptions = (zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }));
  const selectedShare = Number(deployShare) || 100;
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
        {canTail ? <TabsTrigger value="tail">Live tail</TabsTrigger> : null}
        {canRoutes ? <TabsTrigger value="routes">Routes</TabsTrigger> : null}
        <TabsTrigger value="domains">Domains</TabsTrigger>
        <TabsTrigger value="variables">Variables</TabsTrigger>
        <TabsTrigger value="secrets">Secrets</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="versions" className="overflow-auto">
        {versions.isLoading ? (
          <PanelLoading compact />
        ) : versions.isError ? (
          <InlineError message={errorMessage(versions.error)} onRetry={() => void versions.refetch()} />
        ) : (versions.data ?? []).length === 0 ? (
          <PanelMessage>No Worker versions are available.</PanelMessage>
        ) : (
          <div>
            <InspectorBlock className="flex flex-wrap items-center gap-2.5">
              <SelectControl
                ariaLabel="Traffic share for the next deploy"
                className="w-40"
                value={deployShare}
                onValueChange={setDeployShare}
                options={[
                  { value: "10", label: "10% traffic" },
                  { value: "25", label: "25% traffic" },
                  { value: "50", label: "50% traffic" },
                  { value: "75", label: "75% traffic" },
                  { value: "100", label: "100% traffic" },
                ]}
              />
              <p className="min-w-0 flex-1 text-dense text-muted">
                {selectedShare < 100
                  ? `Remainder stays on ${activeVersion ? activeVersion.id.slice(0, 8) : "the current version"}.`
                  : "Replace all live traffic with the chosen version."}
              </p>
            </InspectorBlock>
            <InspectorList>
              {(versions.data ?? []).map((version) => (
                <div key={version.id} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono select-text">{version.id.slice(0, 12)}</p>
                    <p className="mt-0.5 truncate text-label text-muted">
                      {version.trafficPercent !== undefined ? `${version.trafficPercent}% traffic` : "No active traffic"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      ask({
                        title: selectedShare < 100 ? `Deploy this version at ${selectedShare}%` : "Deploy this version at 100%",
                        body:
                          selectedShare < 100
                            ? `${name} · ${version.id.slice(0, 12)} receives ${selectedShare}%. Remaining traffic stays on the current version.`
                            : `${name} · ${version.id}`,
                        actionLabel: "Deploy",
                        intent: "default",
                        onConfirm: async () => {
                          const previous =
                            selectedShare < 100 && activeVersion && activeVersion.id !== version.id
                              ? activeVersion.id
                              : undefined;
                          await window.deployDeck.cloudflare.deployWorkerVersion(
                            accountId,
                            name,
                            version.id,
                            selectedShare,
                            previous,
                          );
                          await client.invalidateQueries({ queryKey: ["worker-deployments", accountId, name] });
                          await client.invalidateQueries({ queryKey: ["worker-versions", accountId, name] });
                          toast.success(
                            selectedShare < 100 ? `Worker version deployed at ${selectedShare}%` : "Worker version deployed",
                          );
                        },
                      })
                    }
                  >
                    Deploy {selectedShare}%
                  </Button>
                </div>
              ))}
            </InspectorList>
          </div>
        )}
      </TabsContent>

      <TabsContent value="deployments" className="overflow-auto">
        {deployments.isLoading ? (
          <PanelLoading compact />
        ) : deployments.isError ? (
          <InlineError message={errorMessage(deployments.error)} onRetry={() => void deployments.refetch()} />
        ) : (deployments.data ?? []).length === 0 ? (
          <PanelMessage>No Worker deployments are available.</PanelMessage>
        ) : (
          <InspectorList>
            {(deployments.data ?? []).map((item) => (
              <div key={item.id} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate font-mono select-text">{item.id.slice(0, 12)}</p>
                  <p className="mt-0.5 truncate text-label text-muted">
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
          </InspectorList>
        )}
      </TabsContent>

      {canTail ? (
        <TabsContent value="tail" className="flex min-h-0 flex-1 flex-col">
          <WorkerTailPanel accountId={accountId} scriptName={name} />
        </TabsContent>
      ) : null}

      {canRoutes ? <TabsContent value="routes" className="overflow-auto">
        <InspectorBlock>
          <form
            className="space-y-2.5"
            onSubmit={async (event) => {
              event.preventDefault();
              const pattern = routePattern.trim();
              const zoneId = routeZoneId || zoneOptions[0]?.value;
              if (!pattern || !zoneId || savingRoute) return;
              setSavingRoute(true);
              try {
                await window.deployDeck.cloudflare.createWorkerRoute(accountId, name, zoneId, pattern);
                setRoutePattern("");
                await client.invalidateQueries({ queryKey: ["worker-routes", accountId, name] });
                toast.success("Worker route added");
              } catch (error) {
                toast.error(errorMessage(error));
              } finally {
                setSavingRoute(false);
              }
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <SelectControl
                ariaLabel="Zone for this route"
                className="w-full"
                value={routeZoneId || zoneOptions[0]?.value || ""}
                onValueChange={setRouteZoneId}
                options={zoneOptions}
                placeholder="Select zone"
                disabled={zoneOptions.length === 0}
              />
              <Input
                aria-label="Route pattern"
                value={routePattern}
                onChange={(event) => setRoutePattern(event.target.value)}
                placeholder="example.com/*"
                className="font-mono"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <Button size="sm" type="submit" loading={savingRoute} disabled={!routePattern.trim() || zoneOptions.length === 0}>
              Add route
            </Button>
          </form>
        </InspectorBlock>
        {routes.isLoading ? (
          <PanelLoading compact />
        ) : routes.isError ? (
          <InlineError message={errorMessage(routes.error)} onRetry={() => void routes.refetch()} />
        ) : (routes.data ?? []).length === 0 ? (
          <PanelMessage>No routes are attached to this Worker.</PanelMessage>
        ) : (
          <InspectorList>
            {(routes.data ?? []).map((route) => (
              <div key={route.id} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate font-mono select-text">{route.pattern}</p>
                  <p className="mt-0.5 truncate text-label text-muted">{route.zoneName ?? route.zoneId}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-failed-ink hover:bg-failed-soft"
                  onClick={() =>
                    ask({
                      title: "Remove Worker route",
                      body: route.pattern,
                      actionLabel: "Remove",
                      intent: "danger",
                      onConfirm: async () => {
                        await window.deployDeck.cloudflare.deleteWorkerRoute(route.zoneId, route.id);
                        await client.invalidateQueries({ queryKey: ["worker-routes", accountId, name] });
                        toast.success("Worker route removed");
                      },
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </InspectorList>
        )}
      </TabsContent> : null}

      <TabsContent value="domains" className="overflow-auto">
        <InspectorBlock>
          <form
            className="space-y-2.5"
            onSubmit={async (event) => {
              event.preventDefault();
              const hostname = domainHost.trim();
              const zoneId = domainZoneId || zoneOptions[0]?.value;
              if (!hostname || !zoneId || savingDomain) return;
              setSavingDomain(true);
              try {
                await window.deployDeck.cloudflare.attachWorkerDomain(accountId, name, hostname, zoneId);
                setDomainHost("");
                await client.invalidateQueries({ queryKey: ["worker-domains", accountId, name] });
                await client.invalidateQueries({ queryKey: ["domains"] });
                toast.success("Worker domain attached");
              } catch (error) {
                toast.error(errorMessage(error));
              } finally {
                setSavingDomain(false);
              }
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <SelectControl
                ariaLabel="Zone for this hostname"
                className="w-full"
                value={domainZoneId || zoneOptions[0]?.value || ""}
                onValueChange={setDomainZoneId}
                options={zoneOptions}
                placeholder="Select zone"
                disabled={zoneOptions.length === 0}
              />
              <Input
                aria-label="Worker hostname"
                value={domainHost}
                onChange={(event) => setDomainHost(event.target.value)}
                placeholder="api.example.com"
                className="font-mono"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <Button size="sm" type="submit" loading={savingDomain} disabled={!domainHost.trim() || zoneOptions.length === 0}>
              Attach domain
            </Button>
          </form>
        </InspectorBlock>
        {domains.isLoading ? (
          <PanelLoading compact />
        ) : domains.isError ? (
          <InlineError message={errorMessage(domains.error)} onRetry={() => void domains.refetch()} />
        ) : (domains.data ?? []).length === 0 ? (
          <PanelMessage>No custom domains are attached to this Worker.</PanelMessage>
        ) : (
          <InspectorList>
            {(domains.data ?? []).map((domain) => (
              <div key={domain.id} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium select-text">{domain.name}</p>
                  <p className="mt-0.5 truncate text-label text-muted">{domain.status}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => void window.deployDeck.shell.openHttps(`https://${domain.name}`)}>
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-failed-ink hover:bg-failed-soft"
                    onClick={() =>
                      ask({
                        title: "Detach Worker domain",
                        body: domain.name,
                        actionLabel: "Detach",
                        intent: "danger",
                        onConfirm: async () => {
                          await window.deployDeck.cloudflare.detachWorkerDomain(accountId, domain.id);
                          await client.invalidateQueries({ queryKey: ["worker-domains", accountId, name] });
                          await client.invalidateQueries({ queryKey: ["domains"] });
                          toast.success("Worker domain detached");
                        },
                      })
                    }
                  >
                    Detach
                  </Button>
                </div>
              </div>
            ))}
          </InspectorList>
        )}
      </TabsContent>

      <TabsContent value="variables" className="overflow-auto">
        <InspectorBlock>
          <form className="space-y-2.5" onSubmit={(event) => void saveWorkerVar(event)}>
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
        </InspectorBlock>
        {vars.isLoading ? (
          <PanelLoading compact />
        ) : vars.isError ? (
          <InlineError message={errorMessage(vars.error)} onRetry={() => void vars.refetch()} />
        ) : (vars.data ?? []).length === 0 ? (
          <PanelMessage>No Worker variables are set.</PanelMessage>
        ) : (
          <InspectorList>
            {(vars.data ?? []).map((item) => (
              <div key={item.id} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0 truncate font-mono select-text">{item.key}</span>
                <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setVarName(item.key);
                    setVarValue(item.value ?? "");
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-failed-ink hover:bg-failed-soft"
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
              </div>
            ))}
          </InspectorList>
        )}
      </TabsContent>

      <TabsContent value="secrets" className="overflow-auto">
        <InspectorBlock>
          <form className="space-y-2.5" onSubmit={(event) => void saveWorkerSecret(event)}>
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
        </InspectorBlock>
        {secrets.isLoading ? (
          <PanelLoading compact />
        ) : secrets.isError ? (
          <InlineError message={errorMessage(secrets.error)} onRetry={() => void secrets.refetch()} />
        ) : (secrets.data ?? []).length === 0 ? (
          <PanelMessage>No Worker secrets are set.</PanelMessage>
        ) : (
          <InspectorList>
            {(secrets.data ?? []).map((item) => (
              <div key={item.id} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate font-mono">{item.key}</p>
                  <p className="mt-0.5 truncate text-label text-muted">Permanently masked</p>
                </div>
                <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSecretName(item.key);
                    setSecretValue("");
                  }}
                >
                  Replace
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-failed-ink hover:bg-failed-soft"
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
              </div>
            ))}
          </InspectorList>
        )}
      </TabsContent>

      <TabsContent value="settings" className="overflow-auto p-4">
        <WorkerSettings accountId={accountId} name={name} onDeleted={onClose} />
      </TabsContent>
    </Tabs>
  );
}

function WorkerSettings({ accountId, name, onDeleted }: { accountId: string; name: string; onDeleted: () => void }) {
  const client = useQueryClient();
  const connection = useConnection();
  const ask = useUiStore((state) => state.askConfirm);
  const setScreen = useUiStore((state) => state.setScreen);
  const canWrite = Boolean(connection.data?.cloudflare.capabilities?.workersWrite);
  const canSchedules = Boolean(connection.data?.cloudflare.capabilities?.workerSchedules);
  const worker = useQuery({ queryKey: ["worker", accountId, name], queryFn: () => window.deployDeck.cloudflare.getWorker(accountId, name) });
  const schedules = useQuery({ queryKey: ["worker-schedules", accountId, name], enabled: canSchedules, queryFn: () => window.deployDeck.cloudflare.listWorkerSchedules(accountId, name) });
  const subdomain = useQuery({ queryKey: ["worker-subdomain", accountId, name], queryFn: () => window.deployDeck.cloudflare.getWorkerSubdomain(accountId, name) });
  const [compatibilityDate, setCompatibilityDate] = useState("");
  const [compatibilityFlags, setCompatibilityFlags] = useState("");
  const [cronText, setCronText] = useState("");
  const [subdomainEnabled, setSubdomainEnabled] = useState(false);
  const [previewsEnabled, setPreviewsEnabled] = useState(false);
  const [observability, setObservability] = useState(false);
  const [source, setSource] = useState<LocalSourceHandle | null>(null);
  const [workerSourceKind, setWorkerSourceKind] = useState<"worker-entry" | "worker-project" | "worker-bundle">("worker-entry");
  const [confirmName, setConfirmName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!worker.data) return;
    setCompatibilityDate(worker.data.compatibilityDate ?? "");
    setCompatibilityFlags(worker.data.compatibilityFlags.join(", "));
  }, [worker.data]);
  useEffect(() => { if (schedules.data) setCronText(schedules.data.map((item) => item.cron).join("\n")); }, [schedules.data]);
  useEffect(() => {
    if (!subdomain.data) return;
    setSubdomainEnabled(subdomain.data.enabled);
    setPreviewsEnabled(Boolean(subdomain.data.previewsEnabled));
  }, [subdomain.data]);
  useEffect(() => () => { if (source) void window.deployDeck.files.releaseLocalSource(source.id); }, [source]);

  const save = async () => {
    setSaving(true);
    try {
      const flags = compatibilityFlags.split(",").map((item) => item.trim()).filter(Boolean);
      const updates: Array<Promise<unknown>> = [
        window.deployDeck.cloudflare.updateWorker(accountId, name, {
          compatibilityDate: compatibilityDate || undefined,
          compatibilityFlags: flags,
          observability,
        }),
        window.deployDeck.cloudflare.updateWorkerSubdomain(accountId, name, {
          enabled: subdomainEnabled,
          previewsEnabled,
        }),
      ];
      if (canSchedules) {
        updates.push(window.deployDeck.cloudflare.updateWorkerSchedules(
          accountId,
          name,
          cronText.split(/\r?\n/).map((cron) => cron.trim()).filter(Boolean).map((cron) => ({ cron })),
        ));
      }
      await Promise.all(updates);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["worker", accountId, name] }),
        client.invalidateQueries({ queryKey: ["worker-schedules", accountId, name] }),
        client.invalidateQueries({ queryKey: ["worker-subdomain", accountId, name] }),
        client.invalidateQueries({ queryKey: ["projects"] }),
      ]);
      toast.success("Worker settings saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (deploy: boolean) => {
    const handle = source ?? await window.deployDeck.files.selectLocalSource(workerSourceKind);
    if (!handle) return;
    setSource(handle);
    try {
      await window.deployDeck.cloudflare.uploadWorker({
        accountId,
        scriptName: name,
        sourceId: handle.id,
        compatibilityDate: compatibilityDate || undefined,
        compatibilityFlags: compatibilityFlags.split(",").map((item) => item.trim()).filter(Boolean),
        message: "Uploaded from DeployDeck",
        deploy,
      });
      await client.invalidateQueries({ queryKey: ["worker-versions", accountId, name] });
      toast.success(deploy ? "Worker deployed" : "Worker version uploaded");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = () => ask({
    title: `Delete Worker ${name}`,
    body: "The Worker, versions, routes, domains, variables, and schedules will be removed from Cloudflare.",
    actionLabel: "Delete Worker",
    intent: "danger",
    onConfirm: async () => {
      await window.deployDeck.cloudflare.deleteWorker(accountId, name);
      await client.invalidateQueries({ queryKey: ["projects"] });
      onDeleted();
      toast.success("Worker deleted");
    },
  });

  if (worker.isLoading || (canSchedules && schedules.isLoading) || subdomain.isLoading) return <PanelLoading compact />;
  if (worker.isError) return <InlineError message={errorMessage(worker.error)} onRetry={() => void worker.refetch()} />;

  return (
    <div className="space-y-5">
      {!canWrite ? (
        <div className="flex items-center justify-between gap-3 rounded-control bg-warning-soft px-3 py-2 text-dense text-warning-ink">
          <span>Worker settings are read-only until Cloudflare grants Workers Scripts write access.</span>
          <Button size="sm" variant="secondary" onClick={() => setScreen("settings")}>Reconnect</Button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <ProjectField label="Compatibility date"><Input type="date" value={compatibilityDate} onChange={(event) => setCompatibilityDate(event.target.value)} /></ProjectField>
        <ProjectField label="Compatibility flags"><Input value={compatibilityFlags} onChange={(event) => setCompatibilityFlags(event.target.value)} placeholder="nodejs_compat" /></ProjectField>
        <ProjectField label="Cron triggers" className="col-span-2"><Textarea className="font-mono text-dense" value={cronText} onChange={(event) => setCronText(event.target.value)} placeholder="0 * * * *" disabled={!canSchedules} /></ProjectField>
        {!canSchedules ? <p className="col-span-2 text-label text-warning-ink">Cron schedules require Workers Cron or Workers Scripts permission; other settings remain available.</p> : null}
        <label className="col-span-2 flex items-center justify-between rounded-control border border-line bg-surface px-3 py-2 text-dense text-ink"><span><strong className="font-medium">workers.dev</strong><span className="mt-0.5 block text-label text-muted">Serve this Worker on the account subdomain.</span></span><SwitchControl checked={subdomainEnabled} onCheckedChange={setSubdomainEnabled} ariaLabel="Enable workers.dev" /></label>
        <label className="col-span-2 flex items-center justify-between rounded-control border border-line bg-surface px-3 py-2 text-dense text-ink"><span><strong className="font-medium">Preview URLs</strong><span className="mt-0.5 block text-label text-muted">Expose version previews on workers.dev.</span></span><SwitchControl checked={previewsEnabled} onCheckedChange={setPreviewsEnabled} ariaLabel="Enable Worker preview URLs" /></label>
        <label className="col-span-2 flex items-center justify-between rounded-control border border-line bg-surface px-3 py-2 text-dense text-ink"><span><strong className="font-medium">Observability</strong><span className="mt-0.5 block text-label text-muted">Send invocation logs and traces to Workers Observability.</span></span><SwitchControl checked={observability} onCheckedChange={setObservability} ariaLabel="Enable Worker observability" /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={saving} disabled={!canWrite} onClick={() => void save()}>Save settings</Button>
        <SelectControl value={workerSourceKind} onValueChange={(next) => { setWorkerSourceKind(next as typeof workerSourceKind); setSource(null); }} options={[{ value: "worker-entry", label: "Entry file" }, { value: "worker-project", label: "Project folder" }, { value: "worker-bundle", label: "Prebuilt bundle" }]} ariaLabel="Worker upload source" size="sm" className="w-40" />
        <Button size="sm" variant="secondary" disabled={!canWrite} onClick={() => void upload(false)}><Upload aria-hidden /> Upload version</Button>
        <Button size="sm" variant="secondary" disabled={!canWrite} onClick={() => void upload(true)}><Upload aria-hidden /> Deploy now</Button>
        <Button size="sm" variant="secondary" onClick={() => void window.deployDeck.cloudflare.downloadWorker(accountId, name)}><Download aria-hidden /> Download source</Button>
      </div>
      {source ? <p className="truncate text-label text-muted">Selected: {source.name} · {source.fileCount} files · opaque local handle</p> : null}
      <div className="rounded-panel border border-failed-ink/25 bg-failed-soft p-3">
        <h3 className="text-body font-semibold text-failed-ink">Danger zone</h3>
        <p className="mt-1 text-dense text-failed-ink">Type <strong>{name}</strong> to enable permanent deletion.</p>
        <div className="mt-3 flex gap-2"><Input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} placeholder={name} aria-label="Confirm Worker name" /><Button size="sm" variant="danger" disabled={!canWrite || confirmName !== name} onClick={remove}><Trash2 aria-hidden /> Delete</Button></div>
      </div>
    </div>
  );
}

function PanelLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div className="divide-y divide-line/70 border-t border-line" aria-label="Loading">
      {Array.from({ length: compact ? 3 : 5 }).map((_, index) => (
        <div key={index} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-3 w-16" />
        </div>
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

/**
 * Full-bleed divided list for inspector tabs. Rows are `PanelRowButton`, so hover and
 * focus reach the panel edges and every list in here looks the same. This
 * replaces nine hand-rolled `divide-y` + `-mx-2 flex min-h-10` variants.
 */
export function InspectorList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line/70 border-t border-line">{children}</div>;
}

/** Padded region for the forms and prose that sit between lists. */
function InspectorBlock({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-3", className)}>{children}</div>;
}
