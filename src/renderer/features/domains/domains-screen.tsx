import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { ProviderMark } from "@/components/common/status-badge";
import { ScreenToolbar } from "@/components/ui/layout";
import { Button, Input, SelectControl } from "@/components/ui/primitives";
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
  const [adding, setAdding] = useState(false);

  const query = useQuery({
    queryKey: ["domains", projects.data],
    enabled: Boolean(projects.data),
    queryFn: async () => {
      const vercel = await Promise.all(
        (projects.data?.vercel ?? []).map((project) =>
          window.deployDeck.vercel.listDomains(project.id).catch(() => []),
        ),
      );
      const pages = await Promise.all(
        (projects.data?.pages ?? []).map((project) =>
          window.deployDeck.cloudflare.listPagesDomains(project.accountId, project.name).catch(() => []),
        ),
      );
      const workers = await Promise.all(
        [...new Set((projects.data?.workers ?? []).map((item) => item.accountId))].map((accountId) =>
          window.deployDeck.cloudflare.listWorkerDomains(accountId).catch(() => []),
        ),
      );
      return [...vercel.flat(), ...pages.flat(), ...workers.flat()];
    },
  });

  if (!connection.data?.vercel.connected && !connection.data?.cloudflare.connected) {
    return <EmptyState title="No domains" body="Connect a provider first." />;
  }

  if (projects.isError) {
    return <ScreenError message={errorMessage(projects.error)} onRetry={() => void projects.refetch()} />;
  }

  const domains = query.data ?? [];
  const targetOptions = [
    ...(projects.data?.vercel ?? []).map((project) => ({
      value: `vercel:${project.id}`,
      label: `Vercel · ${project.name}`,
    })),
    ...(projects.data?.pages ?? []).map((project) => ({
      value: `pages:${project.accountId}:${project.name}`,
      label: `Pages · ${project.name}`,
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
        <Button size="sm" loading={adding} disabled={!name.trim() || !target} onClick={() => void addDomain()}>
          Add domain
        </Button>
      </ScreenToolbar>

      <div className="min-h-0 flex-1 overflow-auto">
        {query.isError ? (
          <ScreenError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : query.isLoading || projects.isLoading ? (
          <EmptyState title="Loading domains" body="Reading domain assignments from connected providers." />
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
                <tr key={`${domain.provider}:${domain.id}`}>
                  <td className="font-medium">{domain.name}</td>
                  <td>
                    <ProviderMark provider={domain.provider} />
                  </td>
                  <td>{domain.projectName}</td>
                  <td className="text-muted">{domain.status}</td>
                  <td className="w-0">
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
                      {domain.provider !== "cloudflare-workers" ? (
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
                                  } else {
                                    await window.deployDeck.cloudflare.removePagesDomain(
                                      domain.accountId,
                                      domain.projectName,
                                      domain.name,
                                    );
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
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
