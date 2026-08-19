import type { EnvironmentVariable } from "@shared/models";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { ScreenToolbar } from "@/components/ui/layout";
import { Button, CheckboxControl, Input, Label, SelectControl, TableSkeleton } from "@/components/ui/primitives";
import { useConnection } from "@/hooks/use-connection";
import { useProjects } from "@/hooks/use-data";
import { errorMessage, formatWhen } from "@/lib/format";
import { envChangeNeedsRedeploy, redeployProduction } from "@/lib/redeploy";
import { useUiStore } from "@/stores/ui-store";
import { toast } from "sonner";

type EnvironmentProvider = "vercel" | "cloudflare-pages" | "cloudflare-workers";

export function EnvironmentsScreen() {
  const connection = useConnection();
  const projects = useProjects();
  const client = useQueryClient();
  const ask = useUiStore((state) => state.askConfirm);
  const [provider, setProvider] = useState<EnvironmentProvider>("vercel");
  const [targetId, setTargetId] = useState("");
  const [env, setEnv] = useState("production");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [secret, setSecret] = useState(false);
  const [branch, setBranch] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EnvironmentVariable>();
  const environmentFocus = useUiStore((state) => state.environmentFocus);

  useEffect(() => {
    if (!environmentFocus) return;
    setProvider(environmentFocus.provider);
    setTargetId(environmentFocus.targetId);
  }, [environmentFocus]);

  const vercelConnected = Boolean(connection.data?.vercel.connected);
  const cloudflareConnected = Boolean(connection.data?.cloudflare.connected);
  const pagesConnected = cloudflareConnected && (connection.data?.cloudflare.capabilities?.pages ?? true);
  const workersConnected = cloudflareConnected && (connection.data?.cloudflare.capabilities?.workers ?? true);
  const vercelProjects = projects.data?.vercel ?? [];
  const pages = projects.data?.pages ?? [];
  const workers = projects.data?.workers ?? [];

  useEffect(() => {
    if (provider === "vercel" && !vercelConnected && (pagesConnected || workersConnected)) {
      setProvider(pagesConnected ? "cloudflare-pages" : "cloudflare-workers");
      setTargetId("");
    } else if (provider === "cloudflare-pages" && !pagesConnected) {
      setProvider(workersConnected ? "cloudflare-workers" : "vercel");
      setTargetId("");
    } else if (provider === "cloudflare-workers" && !workersConnected) {
      setProvider(pagesConnected ? "cloudflare-pages" : "vercel");
      setTargetId("");
    } else if (provider !== "vercel" && !cloudflareConnected && vercelConnected) {
      setProvider("vercel");
      setTargetId("");
    }
  }, [cloudflareConnected, pagesConnected, provider, vercelConnected, workersConnected]);

  const query = useQuery({
    queryKey: ["env-manager", provider, targetId, env],
    enabled: Boolean(targetId),
    queryFn: async () => {
      if (provider === "vercel") return window.deployDeck.vercel.listEnvVars(targetId);
      if (provider === "cloudflare-pages") {
        const [accountId, name] = targetId.split("::");
        return window.deployDeck.cloudflare.listPagesEnv(
          accountId,
          name,
          env === "preview" ? "preview" : "production",
        );
      }
      const [accountId, name] = targetId.split("::");
      const [vars, secrets] = await Promise.all([
        window.deployDeck.cloudflare.listWorkerVars(accountId, name),
        window.deployDeck.cloudflare.listWorkerSecrets(accountId, name),
      ]);
      return [...vars, ...secrets];
    },
  });

  if (!vercelConnected && !pagesConnected && !workersConnected) {
    return (
      <EmptyState
        title="No environment variables"
        body={cloudflareConnected ? "Reconnect Cloudflare with Pages or Workers permission." : "Connect a provider first."}
      />
    );
  }

  if (projects.isError) {
    return <ScreenError message={errorMessage(projects.error)} onRetry={() => void projects.refetch()} />;
  }

  const providerOptions = [
    ...(vercelConnected ? [{ value: "vercel", label: "Vercel" }] : []),
    ...(pagesConnected ? [{ value: "cloudflare-pages", label: "Cloudflare Pages" }] : []),
    ...(workersConnected ? [{ value: "cloudflare-workers", label: "Cloudflare Workers" }] : []),
  ];

  const targetOptions =
    provider === "vercel"
      ? vercelProjects.map((project) => ({ value: project.id, label: project.name }))
      : provider === "cloudflare-pages"
        ? pages.map((project) => ({ value: `${project.accountId}::${project.name}`, label: project.name }))
        : workers.map((worker) => ({
            value: `${worker.accountId}::${worker.name}`,
            label: worker.name,
          }));

  const environmentOptions = [
    { value: "production", label: "Production" },
    { value: "preview", label: "Preview" },
    ...(provider === "vercel" ? [{ value: "development", label: "Development" }] : []),
  ];

  const resetEditor = () => {
    setKey("");
    setValue("");
    setSecret(false);
    setBranch("");
    setEditing(undefined);
  };

  const beginEdit = async (item: EnvironmentVariable) => {
    setEditing(item);
    setKey(item.key);
    setSecret(item.type === "secret" || item.type === "sensitive");
    setBranch(item.branch ?? "");
    if (item.targets[0]) setEnv(item.targets[0]);
    if (item.value) {
      setValue(item.value);
      return;
    }
    if (provider === "vercel" && targetId) {
      try {
        setValue(await window.deployDeck.vercel.revealEnvVar(targetId, item.id));
        return;
      } catch {
        // leave the value blank; the user can type a replacement
      }
    }
    setValue("");
  };

  const saveVariable = async () => {
    const variableName = key.trim();
    if (!targetId || !variableName) return;

    setSaving(true);
    try {
      if (provider === "vercel") {
        const input = {
          key: variableName,
          value,
          targets: [env],
          type: secret ? ("sensitive" as const) : ("encrypted" as const),
          branch: branch.trim() || undefined,
        };
        if (editing) await window.deployDeck.vercel.updateEnvVar(targetId, editing.id, input);
        else await window.deployDeck.vercel.createEnvVar(targetId, input);
      } else if (provider === "cloudflare-pages") {
        const [accountId, name] = targetId.split("::");
        await window.deployDeck.cloudflare.upsertPagesEnv({
          accountId,
          projectName: name,
          environment: env === "preview" ? "preview" : "production",
          name: variableName,
          value,
          secret,
        });
      } else {
        const [accountId, name] = targetId.split("::");
        if (secret) await window.deployDeck.cloudflare.putWorkerSecret(accountId, name, variableName, value);
        else await window.deployDeck.cloudflare.upsertWorkerVar(accountId, name, variableName, value);
      }
      toast.success(editing ? "Variable updated" : "Variable saved");
      resetEditor();
      await client.invalidateQueries({ queryKey: ["env-manager"] });
      if (envChangeNeedsRedeploy(provider) && env === "production") {
        ask({
          title: "Redeploy production?",
          body: "The new variable takes effect on the next production deployment.",
          actionLabel: "Redeploy",
          onConfirm: async () => {
            try {
              if (provider === "vercel") {
                await redeployProduction({
                  provider: "vercel",
                  id: targetId,
                  name: vercelProjects.find((project) => project.id === targetId)?.name ?? targetId,
                  accountId: "",
                });
              } else if (provider === "cloudflare-pages") {
                const [accountId, name] = targetId.split("::");
                await redeployProduction({
                  provider: "cloudflare-pages",
                  id: name,
                  name,
                  accountId,
                });
              }
              toast.success("Production redeploy started");
              await client.invalidateQueries({ queryKey: ["deployments"] });
            } catch (error) {
              toast.error(errorMessage(error));
            }
          },
        });
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const items = query.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <ScreenToolbar>
        <SelectControl
          ariaLabel="Provider"
          className="min-w-40"
          value={provider}
          onValueChange={(next) => {
            setProvider(next as EnvironmentProvider);
            setTargetId("");
            setEditing(undefined);
          }}
          options={providerOptions}
        />
        <SelectControl
          ariaLabel="Project or Worker"
          placeholder={provider === "cloudflare-workers" ? "Select Worker" : "Select project"}
          className="min-w-48 max-w-72"
          value={targetId}
          onValueChange={(next) => {
            setTargetId(next);
            setEditing(undefined);
          }}
          options={targetOptions}
          disabled={targetOptions.length === 0}
        />
        {provider !== "cloudflare-workers" ? (
          <SelectControl
            ariaLabel="Environment"
            className="min-w-32"
            value={env}
            onValueChange={setEnv}
            options={environmentOptions}
          />
        ) : null}
        {provider === "vercel" ? (
          <Input
            aria-label="Git branch"
            placeholder="Branch (optional)"
            className="w-40 font-mono"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          />
        ) : null}
      </ScreenToolbar>

      <ScreenToolbar className="min-h-11">
        <Input
          aria-label="Variable name"
          placeholder="VARIABLE_NAME"
          className="max-w-48 font-mono"
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
        <Input
          aria-label="Variable value"
          type={secret ? "password" : "text"}
          placeholder="Value"
          className="max-w-72 font-mono"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void saveVariable();
          }}
        />
        <Label htmlFor="environment-secret" className="flex cursor-default items-center gap-2 text-[12px] text-ink">
          <CheckboxControl
            id="environment-secret"
            checked={secret}
            onCheckedChange={setSecret}
            ariaLabel="Store as secret"
          />
          Secret
        </Label>
        {editing ? (
          <Button size="sm" variant="ghost" className="text-muted" onClick={resetEditor}>
            Cancel
          </Button>
        ) : null}
        <Button
          size="sm"
          loading={saving}
          disabled={!targetId || !key.trim() || !value}
          onClick={() => void saveVariable()}
        >
          {editing ? "Update variable" : "Save variable"}
        </Button>
      </ScreenToolbar>

      <div className="min-h-0 flex-1 overflow-auto">
        {!targetId ? (
          <EmptyState
            title={targetOptions.length > 0 ? "Select a project" : "No projects available"}
            body={
              targetOptions.length > 0
                ? "Choose a project or Worker above to inspect and manage its variables."
                : "This provider has no projects or Workers available for environment management."
            }
          />
        ) : query.isError ? (
          <ScreenError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <TableSkeleton columns={5} label="Loading variables" />
        ) : items.length === 0 ? (
          <EmptyState
            title="No variables"
            body="Create the first variable for this project or Worker using the toolbar above."
          />
        ) : (
          <table className="data-table" aria-label="Environment variables">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Target</th>
                <th scope="col">Updated</th>
                <th scope="col">Value</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <EnvTableRow
                  key={item.id}
                  item={item}
                  editing={editing?.id === item.id}
                  onEdit={() => void beginEdit(item)}
                  onReveal={
                    provider === "vercel" && targetId
                      ? () => window.deployDeck.vercel.revealEnvVar(targetId, item.id)
                      : undefined
                  }
                  onDelete={() =>
                    ask({
                      title: "Delete environment variable",
                      body: item.key,
                      actionLabel: "Delete",
                      onConfirm: async () => {
                        try {
                          if (provider === "vercel") {
                            await window.deployDeck.vercel.deleteEnvVar(targetId, item.id);
                          } else if (provider === "cloudflare-pages") {
                            const [accountId, name] = targetId.split("::");
                            await window.deployDeck.cloudflare.deletePagesEnv(
                              accountId,
                              name,
                              env === "preview" ? "preview" : "production",
                              item.key,
                            );
                          } else {
                            const [accountId, name] = targetId.split("::");
                            if (item.type === "secret") {
                              await window.deployDeck.cloudflare.deleteWorkerSecret(accountId, name, item.key);
                            } else {
                              await window.deployDeck.cloudflare.deleteWorkerVar(accountId, name, item.key);
                            }
                          }
                          toast.success("Variable deleted");
                          await client.invalidateQueries({ queryKey: ["env-manager"] });
                        } catch (error) {
                          toast.error(errorMessage(error));
                        }
                      },
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EnvTableRow({
  item,
  editing,
  onEdit,
  onReveal,
  onDelete,
}: {
  item: { key: string; type: string; targets: string[]; branch?: string; updatedAt?: string; value?: string };
  editing?: boolean;
  onEdit: () => void;
  onReveal?: () => Promise<string>;
  onDelete: () => void;
}) {
  const [revealedValue, setRevealedValue] = useState<string>();
  const [revealing, setRevealing] = useState(false);

  const toggleReveal = async () => {
    if (revealedValue !== undefined) {
      setRevealedValue(undefined);
      return;
    }
    if (!onReveal) return;

    setRevealing(true);
    try {
      setRevealedValue(await onReveal());
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRevealing(false);
    }
  };

  return (
    <tr>
      <td className="font-mono font-medium">{item.key}</td>
      <td>{item.type}</td>
      <td>{[item.targets.join(", "), item.branch].filter(Boolean).join(" · ") || "—"}</td>
      <td className="tabular text-muted">{formatWhen(item.updatedAt, "absolute")}</td>
      <td className="max-w-80 truncate font-mono">{revealedValue ?? item.value ?? "••••••"}</td>
      <td className="w-0">
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={editing || undefined}
            aria-label={`Edit ${item.key}`}
            onClick={onEdit}
          >
            {editing ? "Editing" : "Edit"}
          </Button>
          {onReveal ? (
            <Button
              size="sm"
              variant="ghost"
              loading={revealing}
              aria-label={`${revealedValue !== undefined ? "Hide" : "Reveal"} ${item.key}`}
              onClick={() => void toggleReveal()}
            >
              {revealedValue !== undefined ? "Hide" : "Reveal"}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="text-failed hover:bg-failed/10 hover:text-failed"
            aria-label={`Delete ${item.key}`}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}
