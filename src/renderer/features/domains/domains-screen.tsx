import type { UnifiedDomain } from "@shared/models";
import { domainNeedsDns } from "@shared/domain-dns";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, MoreHorizontal, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { DomainVerification } from "@/components/domains/domain-verification";
import { ProviderMark } from "@/components/common/status-badge";
import { InspectorHeader, InspectorPanel, ResourceListFrame, ScreenToolbar } from "@/components/ui/layout";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/menu";
import { Panel } from "@/components/ui/panel";
import { Badge, type BadgeProps, Button, Input, SelectControl, TableSkeleton } from "@/components/ui/primitives";
import { useConnection } from "@/hooks/use-connection";
import { useProjects, useZones } from "@/hooks/use-data";
import { copyText, errorMessage } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";
import { toast } from "sonner";

export function DomainsScreen() {
  const connection = useConnection();
  const projects = useProjects();
  const client = useQueryClient();
  const ask = useUiStore((state) => state.askConfirm);
  const setScreen = useUiStore((state) => state.setScreen);
  const createIntent = useUiStore((state) => state.createResource);
  const closeCreate = useUiStore((state) => state.closeCreate);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<UnifiedDomain>();
  const [inspectorReturnFocus, setInspectorReturnFocus] = useState<HTMLElement | null>(null);
  const zones = useZones();

  const query = useQuery({
    queryKey: ["domains", projects.data],
    enabled: Boolean(projects.data),
    queryFn: async () => {
      // A source that fails must not be indistinguishable from a source with no domains.
      const failed: string[] = [];
      const collect = async <T,>(label: string, run: () => Promise<T[]>): Promise<T[]> => {
        try {
          return await run();
        } catch {
          failed.push(label);
          return [];
        }
      };

      const vercel = await Promise.all(
        (projects.data?.vercel ?? []).map((project) =>
          collect(project.name, () => window.deployDeck.vercel.listDomains(project.id)),
        ),
      );
      const pages = await Promise.all(
        (projects.data?.pages ?? []).map((project) =>
          collect(project.name, () => window.deployDeck.cloudflare.listPagesDomains(project.accountId, project.name)),
        ),
      );
      const workers = await Promise.all(
        [...new Set((projects.data?.workers ?? []).map((item) => item.accountId))].map((accountId) =>
          collect("Workers", () => window.deployDeck.cloudflare.listWorkerDomains(accountId)),
        ),
      );

      return { items: [...vercel.flat(), ...pages.flat(), ...workers.flat()], failed };
    },
  });

  const workerTarget = target.startsWith("workers:");
  const firstZoneId = zones.data?.[0]?.id;

  useEffect(() => {
    if (!workerTarget || zoneId || !firstZoneId) return;
    setZoneId(firstZoneId);
  }, [firstZoneId, workerTarget, zoneId]);

  useEffect(() => {
    if (createIntent !== "domain") return;
    const timer = window.setTimeout(() => {
      nameInputRef.current?.focus();
      closeCreate();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [closeCreate, createIntent]);

  if (!connection.data?.vercel.connected && !connection.data?.cloudflare.connected) {
    return <EmptyState title="No domains" body="Connect a provider first." />;
  }

  if (projects.isError) {
    return <ScreenError message={errorMessage(projects.error)} onRetry={() => void projects.refetch()} />;
  }

  const domains = query.data?.items ?? [];
  const failedSources = query.data?.failed ?? [];
  const targetOptions = [
    ...(projects.data?.vercel ?? []).map((project) => ({
      value: `vercel:${project.id}`,
      label: `Vercel · ${project.name}`,
    })),
    ...(projects.data?.pages ?? []).map((project) => ({
      value: `pages:${project.accountId}:${project.name}`,
      label: `Pages · ${project.name}`,
    })),
    ...(projects.data?.workers ?? []).map((worker) => ({
      value: `workers:${worker.accountId}:${worker.name}`,
      label: `Workers · ${worker.name}`,
    })),
  ];
  const zoneOptions = (zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }));
  const canWriteTarget = !target
    || target.startsWith("vercel:")
    || (target.startsWith("pages:") && Boolean(connection.data?.cloudflare.capabilities?.pagesWrite))
    || (target.startsWith("workers:") && Boolean(connection.data?.cloudflare.capabilities?.workerRoutes));

  const addDomain = async () => {
    const domainName = name.trim();
    if (!domainName || !target) return;
    if (workerTarget && !zoneId) return;

    setAdding(true);
    try {
      if (target.startsWith("vercel:")) {
        await window.deployDeck.vercel.addDomain(target.slice(7), domainName);
      } else if (target.startsWith("pages:")) {
        const [, accountId, ...projectNameParts] = target.split(":");
        await window.deployDeck.cloudflare.addPagesDomain(accountId, projectNameParts.join(":"), domainName);
      } else if (target.startsWith("workers:")) {
        const [, accountId, ...scriptParts] = target.split(":");
        await window.deployDeck.cloudflare.attachWorkerDomain(accountId, scriptParts.join(":"), domainName, zoneId);
      }
      toast.success("Domain added");
      setName("");
      await client.invalidateQueries({ queryKey: ["domains"] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAdding(false);
    }
  };

  const requestRemove = (domain: UnifiedDomain) => {
    ask({
      title: "Remove domain",
      body: `${domain.name} will be detached from ${domain.projectName}.`,
      actionLabel: "Remove",
      onConfirm: async () => {
        try {
          if (domain.provider === "vercel") {
            await window.deployDeck.vercel.removeDomain(domain.projectId, domain.name);
          } else if (domain.provider === "cloudflare-pages") {
            await window.deployDeck.cloudflare.removePagesDomain(domain.accountId, domain.projectName, domain.name);
          } else {
            await window.deployDeck.cloudflare.detachWorkerDomain(domain.accountId, domain.id);
          }
          toast.success("Domain removed");
          await client.invalidateQueries({ queryKey: ["domains"] });
        } catch (error) {
          toast.error(errorMessage(error));
        }
      },
    });
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
      <ResourceListFrame>
      <Panel className="min-h-0 flex-1">
      <ScreenToolbar>
        <Input
          ref={nameInputRef}
          aria-label="Domain name"
          placeholder="domain.com"
          className="max-w-56"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void addDomain();
          }}
        />
        <SelectControl
          ariaLabel="Project to add the domain to"
          placeholder="Add to project"
          className="min-w-44 max-w-64"
          value={target}
          onValueChange={setTarget}
          options={targetOptions}
          disabled={targetOptions.length === 0}
        />
        {workerTarget ? (
          <SelectControl
            ariaLabel="Cloudflare zone for this Worker hostname"
            placeholder="Select zone"
            className="min-w-40 max-w-56"
            value={zoneId}
            onValueChange={setZoneId}
            options={zoneOptions}
            disabled={zoneOptions.length === 0}
          />
        ) : null}
        <Button
          size="sm"
          variant="accent"
          loading={adding}
          disabled={!name.trim() || !target || !canWriteTarget || (workerTarget && !zoneId)}
          onClick={() => void addDomain()}
        >
          Add domain
        </Button>
        {target && !canWriteTarget ? <Button size="sm" variant="ghost" className="text-warning-ink" onClick={() => setScreen("settings")}>Reconnect for write access</Button> : null}
        <div className="ml-auto flex shrink-0 items-center gap-3 text-dense text-muted">
          {query.isFetching && !query.isLoading ? <span>Updating…</span> : null}
          {query.isLoading || projects.isLoading ? null : (
            <span className="tabular">
              {domains.length} {domains.length === 1 ? "domain" : "domains"}
            </span>
          )}
        </div>
      </ScreenToolbar>

      {failedSources.length > 0 ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 border-b border-line bg-failed-soft px-6 py-2.5 text-dense text-failed-ink"
        >
          <span className="flex min-w-0 items-center gap-2">
            <TriangleAlert className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="truncate">
              {failedSources.length === 1
                ? `Domains for ${failedSources[0]} could not be loaded.`
                : `Domains for ${failedSources.length} sources could not be loaded.`}
            </span>
          </span>
          <Button size="sm" variant="ghost" className="shrink-0 text-failed-ink hover:bg-failed-ink/10" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {query.isError ? (
          <ScreenError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : query.isLoading || projects.isLoading ? (
          <TableSkeleton columns={5} label="Loading domains" />
        ) : domains.length === 0 ? (
          <EmptyState
            title="No domains yet"
            body={
              targetOptions.length > 0
                ? "Add a domain to one of your projects using the toolbar above."
                : "Create or import a project before assigning a domain."
            }
          />
        ) : (
          <table className="data-table data-table-fixed min-w-[850px]" aria-label="Domains">
            <colgroup>
              <col />
              <col style={{ width: 124 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 56 }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Domain</th>
                <th scope="col">Provider</th>
                <th scope="col">Project</th>
                <th scope="col">Status</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <Fragment key={`${domain.provider}:${domain.id}`}>
                <tr>
                  <td className="truncate font-medium">{domain.name}</td>
                  <td className="truncate">
                    <ProviderMark provider={domain.provider} />
                  </td>
                  <td className="truncate">{domain.projectName}</td>
                  <td>
                    <DomainStatus domain={domain} />
                  </td>
                  <td>
                    <DomainActions
                      domain={domain}
                      onEdit={(trigger) => {
                        setInspectorReturnFocus(trigger);
                        setSelected(domain);
                      }}
                      onRemove={() => requestRemove(domain)}
                    />
                  </td>
                </tr>
                {/* Verification records live in their own recessed sub-row.
                    Nesting them in the name cell made every row a different
                    height and broke the table's rhythm. */}
                {domainNeedsDns(domain) && (domain.verificationRecords ?? []).length > 0 ? (
                  <tr>
                    <td colSpan={5} className="h-auto whitespace-normal bg-surface-sunken py-3">
                      <DomainVerification
                        domain={domain}
                        onWritten={() => void client.invalidateQueries({ queryKey: ["dns-records"] })}
                      />
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </Panel>
      </ResourceListFrame>
      </div>
      {selected ? (
        <DomainInspector
          key={`${selected.provider}:${selected.id}`}
          domain={selected}
          projects={projects.data?.vercel ?? []}
          returnFocusTo={inspectorReturnFocus}
          onClose={() => {
            setSelected(undefined);
            setInspectorReturnFocus(null);
          }}
          onUpdated={async (domain) => {
            setSelected(domain);
            await client.invalidateQueries({ queryKey: ["domains"] });
          }}
        />
      ) : null}
    </div>
  );
}

function DomainActions({ domain, onEdit, onRemove }: { domain: UnifiedDomain; onEdit: (trigger: HTMLButtonElement | null) => void; onRemove: () => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex justify-end">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button ref={triggerRef} size="icon-sm" variant="ghost" aria-label={`Actions for ${domain.name}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            window.setTimeout(() => triggerRef.current?.focus(), 0);
          }}
        >
          <DropdownMenuItem onSelect={() => void window.deployDeck.shell.openHttps(`https://${domain.name}`)}>
            <ExternalLink aria-hidden /> Open domain
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void copyText(domain.name)}>
            <Copy aria-hidden /> Copy domain
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(triggerRef.current)}>
            <Pencil aria-hidden /> Edit domain
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={onRemove}>
            <Trash2 aria-hidden /> Remove domain
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu.Root>
    </div>
  );
}

function DomainInspector({ domain, projects, returnFocusTo, onClose, onUpdated }: {
  domain: UnifiedDomain;
  projects: Array<{ id: string; name: string }>;
  returnFocusTo?: HTMLElement | null;
  onClose: () => void;
  onUpdated: (domain: UnifiedDomain) => Promise<void>;
}) {
  const [redirect, setRedirect] = useState(domain.redirectTo ?? "");
  const [redirectStatus, setRedirectStatus] = useState("308");
  const [branch, setBranch] = useState(domain.gitBranch ?? "");
  const [customEnvironmentId, setCustomEnvironmentId] = useState(domain.customEnvironmentId ?? "");
  const [targetProject, setTargetProject] = useState(domain.projectId);
  const [saving, setSaving] = useState(false);
  const vercel = domain.provider === "vercel";

  const save = async () => {
    if (!vercel) return;
    setSaving(true);
    try {
      const updated = await window.deployDeck.vercel.updateDomain(domain.projectId, domain.name, {
        redirect: redirect.trim() || null,
        redirectStatusCode: redirect.trim() ? Number(redirectStatus) as 301 | 302 | 307 | 308 : null,
        gitBranch: branch.trim() || null,
        customEnvironmentId: customEnvironmentId.trim() || null,
      });
      await onUpdated(updated);
      toast.success("Domain settings saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const move = async () => {
    if (!vercel || !targetProject || targetProject === domain.projectId) return;
    setSaving(true);
    try {
      const updated = await window.deployDeck.vercel.moveDomain(domain.projectId, domain.name, targetProject);
      await onUpdated(updated);
      toast.success("Domain moved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <InspectorPanel size="md" className="deployment-inspector overflow-hidden" onDismiss={onClose} returnFocusTo={returnFocusTo} aria-label={`${domain.name} domain inspector`}>
      <InspectorHeader title={domain.name} subtitle={`${domain.projectName} · ${domain.provider}`} onClose={onClose} closeLabel={`Close ${domain.name} inspector`} />
      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
        <dl className="divide-y divide-line rounded-panel border border-line bg-panel">
          <div className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2"><dt className="text-dense text-muted">Status</dt><dd><DomainStatus domain={domain} /></dd></div>
          <div className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2"><dt className="text-dense text-muted">Project</dt><dd className="text-dense text-ink">{domain.projectName}</dd></div>
          <div className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2"><dt className="text-dense text-muted">Created</dt><dd className="text-dense text-ink">{domain.createdAt ?? "—"}</dd></div>
        </dl>
        {vercel ? (
          <div className="space-y-4">
            <label className="block space-y-1.5 text-label font-medium text-muted"><span>Git branch</span><Input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="Production branch" /></label>
            <label className="block space-y-1.5 text-label font-medium text-muted"><span>Custom environment ID</span><Input value={customEnvironmentId} onChange={(event) => setCustomEnvironmentId(event.target.value)} placeholder="Optional custom environment" /></label>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <label className="block space-y-1.5 text-label font-medium text-muted"><span>Redirect target</span><Input value={redirect} onChange={(event) => setRedirect(event.target.value)} placeholder="www.example.com" /></label>
              <label className="block space-y-1.5 text-label font-medium text-muted"><span>Status</span><SelectControl value={redirectStatus} onValueChange={setRedirectStatus} options={[{ value: "301", label: "301" }, { value: "302", label: "302" }, { value: "307", label: "307" }, { value: "308", label: "308" }]} ariaLabel="Redirect status" className="w-full" /></label>
            </div>
            <Button size="sm" loading={saving} onClick={() => void save()}>Save domain settings</Button>
            <div className="border-t border-line pt-4">
              <label className="block space-y-1.5 text-label font-medium text-muted"><span>Move to project</span><SelectControl value={targetProject} onValueChange={setTargetProject} options={projects.map((project) => ({ value: project.id, label: project.name }))} ariaLabel="Target Vercel project" className="w-full" /></label>
              <Button size="sm" variant="secondary" className="mt-2" loading={saving} disabled={targetProject === domain.projectId} onClick={() => void move()}>Move domain</Button>
            </div>
          </div>
        ) : (
          <p className="text-dense text-muted">Provider-specific routing and deployment settings are managed from the project inspector. Verification records remain available in the table.</p>
        )}
      </div>
    </InspectorPanel>
  );
}

/**
 * Domain state as a pill. The provider strings differ between Vercel and
 * Cloudflare, so this maps the shapes they actually return onto one vocabulary
 * instead of printing the raw value.
 */
function DomainStatus({ domain }: { domain: UnifiedDomain }) {
  const raw = (domain.status ?? "").toLowerCase();
  let variant: NonNullable<BadgeProps["variant"]> = "neutral";
  let label = "Unknown";
  if (domain.verified || /^(active|attached|verified|ready|valid)/.test(raw)) {
    variant = "ready";
    label = domain.verified ? "Verified" : "Active";
  } else if (/(pending|initializing|verifying|provisioning|deploying)/.test(raw)) {
    variant = "building";
    label = "Pending";
  } else if (/(error|fail|invalid|misconfigur|moved|blocked|deactivat)/.test(raw)) {
    variant = "failed";
    label = "Error";
  }

  return (
    <Badge variant={variant} dot pulse={variant === "building"} className="max-w-full capitalize">
      <span className="truncate">{label}</span>
    </Badge>
  );
}
