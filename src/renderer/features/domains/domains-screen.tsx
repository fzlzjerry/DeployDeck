import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { VerificationRecords } from "@/features/domains/verification-records";
import { useZones } from "@/hooks/use-data";
import { ProviderMark } from "@/components/common/status-badge";
import { ScreenToolbar } from "@/components/ui/layout";
import { Button, Input, SelectControl, TableSkeleton } from "@/components/ui/primitives";
import { useConnection } from "@/hooks/use-connection";
import { useProjects } from "@/hooks/use-data";
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
  const [expanded, setExpanded] = useState<string>();

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

  const addDomain = async () => {
    const domainName = name.trim();
    if (!domainName || !target) return;

    setAdding(true);
    try {
      if (target.startsWith("vercel:")) {
        await window.deployDeck.vercel.addDomain(target.slice(7), domainName);
      } else if (target.startsWith("pages:")) {
        const [, accountId, ...projectNameParts] = target.split(":");
        await window.deployDeck.cloudflare.addPagesDomain(accountId, projectNameParts.join(":"), domainName);
      } else if (target.startsWith("workers:")) {
        const [, accountId, ...scriptParts] = target.split(":");
        if (!zoneId) {
          toast.error("Select a DNS zone for this Worker domain.");
          return;
        }
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
        {target.startsWith("workers:") ? (
          <SelectControl
            ariaLabel="DNS zone for Worker domain"
            placeholder="Select zone"
            className="min-w-36 max-w-52"
            value={zoneId}
            onValueChange={setZoneId}
            options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
            disabled={(zones.data ?? []).length === 0}
          />
        ) : null}
        <Button size="sm" loading={adding} disabled={!name.trim() || !target || (target.startsWith("workers:") && !zoneId)} onClick={() => void addDomain()}>
          Add domain
        </Button>
      </ScreenToolbar>

      {failedSources.length > 0 ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 border-b border-line bg-failed-soft px-4 py-2 text-[12px] text-failed"
        >
          <span className="min-w-0 truncate">
            {failedSources.length === 1
              ? `Domains for ${failedSources[0]} could not be loaded.`
              : `Domains for ${failedSources.length} sources could not be loaded.`}
          </span>
          <Button size="sm" variant="ghost" className="shrink-0 text-failed" onClick={() => void query.refetch()}>
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
                    <td className="font-medium">{domain.name}</td>
                    <td>
                      <ProviderMark provider={domain.provider} />
                    </td>
                    <td>{domain.projectName}</td>
                    <td className="text-muted">{domain.status}</td>
                    <td className="w-0">
                      <div className="flex justify-end gap-1">
                        {domain.verificationRecords.length > 0 && !domain.verified ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-expanded={expanded === domain.id}
                            onClick={() => setExpanded(expanded === domain.id ? undefined : domain.id)}
                          >
                            {expanded === domain.id ? "Hide records" : "Records"}
                          </Button>
                        ) : null}
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
                          className="text-failed hover:bg-failed/10 hover:text-failed"
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
                  {expanded === domain.id ? (
                    <tr>
                      <td colSpan={5} className="whitespace-normal py-2">
                        <VerificationRecords records={domain.verificationRecords} />
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
