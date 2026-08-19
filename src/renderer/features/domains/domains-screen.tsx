import type { UnifiedDomain } from "@shared/models";
import { domainNeedsDns } from "@shared/domain-dns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { DomainVerification } from "@/components/domains/domain-verification";
import { ProviderMark } from "@/components/common/status-badge";
import { ScreenToolbar } from "@/components/ui/layout";
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
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [adding, setAdding] = useState(false);
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

  return (
    <div className="flex h-full flex-col">
      <ScreenToolbar>
        <Input
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
          loading={adding}
          disabled={!name.trim() || !target || (workerTarget && !zoneId)}
          onClick={() => void addDomain()}
        >
          Add domain
        </Button>
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
          <table className="data-table" aria-label="Domains">
            <colgroup>
              <col />
              <col style={{ width: 124 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 216 }} />
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
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Open ${domain.name}`}
                        onClick={() => void window.deployDeck.shell.openHttps(`https://${domain.name}`)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Copy ${domain.name}`}
                        onClick={() => void copyText(domain.name)}
                      >
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-failed-ink hover:bg-failed-soft"
                        aria-label={`Remove ${domain.name}`}
                        onClick={() =>
                          ask({
                            title: "Remove domain",
                            body: `${domain.name} will be detached from ${domain.projectName}.`,
                            actionLabel: "Remove",
                            onConfirm: async () => {
                              try {
                                if (domain.provider === "vercel") {
                                  await window.deployDeck.vercel.removeDomain(domain.projectId, domain.name);
                                } else if (domain.provider === "cloudflare-pages") {
                                  await window.deployDeck.cloudflare.removePagesDomain(
                                    domain.accountId,
                                    domain.projectName,
                                    domain.name,
                                  );
                                } else {
                                  await window.deployDeck.cloudflare.detachWorkerDomain(domain.accountId, domain.id);
                                }
                                toast.success("Domain removed");
                                await client.invalidateQueries({ queryKey: ["domains"] });
                              } catch (error) {
                                toast.error(errorMessage(error));
                              }
                            },
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
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
    </div>
  );
}

/**
 * Domain state as a pill. The provider strings differ between Vercel and
 * Cloudflare, so this maps the shapes they actually return onto one vocabulary
 * instead of printing the raw value.
 */
function DomainStatus({ domain }: { domain: UnifiedDomain }) {
  const raw = (domain.status ?? "").toLowerCase();
  const label = domain.status || (domain.verified ? "Verified" : "Unknown");

  let variant: NonNullable<BadgeProps["variant"]> = "neutral";
  if (domain.verified || /^(active|verified|ready|valid)/.test(raw)) variant = "ready";
  else if (/(pending|initializing|verifying|provisioning|deploying)/.test(raw)) variant = "building";
  else if (/(error|fail|invalid|misconfigur|moved|blocked|deactivat)/.test(raw)) variant = "failed";

  return (
    <Badge variant={variant} dot pulse={variant === "building"} className="capitalize">
      {label}
    </Badge>
  );
}
