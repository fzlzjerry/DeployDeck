import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { Button, Input, SelectControl, Skeleton } from "@/components/ui/primitives";
import { useZones } from "@/hooks/use-data";
import { errorMessage } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";
import { toast } from "sonner";

export function WorkerRoutesPanel({ accountId, name }: { accountId: string; name: string }) {
  const client = useQueryClient();
  const ask = useUiStore((state) => state.askConfirm);
  const zones = useZones();
  const [pattern, setPattern] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [saving, setSaving] = useState(false);
  const routes = useQuery({
    queryKey: ["worker-routes", accountId, name],
    queryFn: () => window.deployDeck.cloudflare.listWorkerRoutes(accountId, name),
  });

  const addRoute = async (event: FormEvent) => {
    event.preventDefault();
    const nextPattern = pattern.trim();
    if (!nextPattern || !zoneId || saving) return;
    setSaving(true);
    try {
      await window.deployDeck.cloudflare.createWorkerRoute(zoneId, nextPattern, name);
      setPattern("");
      await client.invalidateQueries({ queryKey: ["worker-routes", accountId, name] });
      toast.success("Route added");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <form className="space-y-2" onSubmit={(event) => void addRoute(event)}>
        <Input
          aria-label="Route pattern"
          value={pattern}
          onChange={(event) => setPattern(event.target.value)}
          placeholder="example.com/*"
          autoCapitalize="none"
          spellCheck={false}
        />
        <div className="flex gap-2">
          <SelectControl
            ariaLabel="Zone for this route"
            className="min-w-0 flex-1"
            placeholder="Select zone"
            value={zoneId}
            onValueChange={setZoneId}
            options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
            disabled={(zones.data ?? []).length === 0}
          />
          <Button size="sm" type="submit" loading={saving} disabled={!pattern.trim() || !zoneId}>
            Add route
          </Button>
        </div>
      </form>
      {routes.isLoading ? (
        <Skeleton className="h-8" />
      ) : routes.isError ? (
        <ScreenError size="inline" message={errorMessage(routes.error)} onRetry={() => void routes.refetch()} />
      ) : (routes.data ?? []).length === 0 ? (
        <EmptyState size="inline" title="No routes are attached to this Worker." />
      ) : (
        <div className="divide-y divide-line/70 border-t border-line">
          {(routes.data ?? []).map((route) => (
            <div key={route.id} className="flex min-h-10 items-center justify-between gap-3 py-2 text-[12px]">
              <div className="min-w-0">
                <p className="truncate font-mono select-text">{route.pattern}</p>
                <p className="mt-0.5 text-[11px] text-muted">{route.zoneName ?? route.zoneId ?? "Zone"}</p>
              </div>
              {route.zoneId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-failed hover:bg-failed-soft"
                  onClick={() =>
                    ask({
                      title: "Delete Worker route",
                      body: route.pattern,
                      actionLabel: "Delete",
                      intent: "danger",
                      onConfirm: async () => {
                        await window.deployDeck.cloudflare.deleteWorkerRoute(route.zoneId!, route.id);
                        await client.invalidateQueries({ queryKey: ["worker-routes", accountId, name] });
                        toast.success("Route deleted");
                      },
                    })
                  }
                >
                  Delete
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkerDomainsPanel({ accountId, name }: { accountId: string; name: string }) {
  const client = useQueryClient();
  const ask = useUiStore((state) => state.askConfirm);
  const zones = useZones();
  const [hostname, setHostname] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [saving, setSaving] = useState(false);
  const domains = useQuery({
    queryKey: ["worker-domains", accountId, name],
    queryFn: () => window.deployDeck.cloudflare.listWorkerDomains(accountId, name),
  });

  const attach = async (event: FormEvent) => {
    event.preventDefault();
    const next = hostname.trim();
    if (!next || !zoneId || saving) return;
    setSaving(true);
    try {
      await window.deployDeck.cloudflare.attachWorkerDomain(accountId, name, next, zoneId);
      setHostname("");
      await client.invalidateQueries({ queryKey: ["worker-domains"] });
      await client.invalidateQueries({ queryKey: ["domains"] });
      toast.success("Domain attached");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <form className="space-y-2" onSubmit={(event) => void attach(event)}>
        <Input
          aria-label="Worker hostname"
          value={hostname}
          onChange={(event) => setHostname(event.target.value)}
          placeholder="api.example.com"
          autoCapitalize="none"
          spellCheck={false}
        />
        <div className="flex gap-2">
          <SelectControl
            ariaLabel="Zone for this hostname"
            className="min-w-0 flex-1"
            placeholder="Select zone"
            value={zoneId}
            onValueChange={setZoneId}
            options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
            disabled={(zones.data ?? []).length === 0}
          />
          <Button size="sm" type="submit" loading={saving} disabled={!hostname.trim() || !zoneId}>
            Attach
          </Button>
        </div>
      </form>
      {domains.isLoading ? (
        <Skeleton className="h-8" />
      ) : domains.isError ? (
        <ScreenError size="inline" message={errorMessage(domains.error)} onRetry={() => void domains.refetch()} />
      ) : (domains.data ?? []).length === 0 ? (
        <EmptyState size="inline" title="No custom domains are attached to this Worker." />
      ) : (
        <div className="divide-y divide-line/70 border-t border-line">
          {(domains.data ?? []).map((domain) => (
            <div key={domain.id} className="flex min-h-10 items-center justify-between gap-3 py-2 text-[12px]">
              <span className="min-w-0 truncate font-medium select-text">{domain.name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="text-failed hover:bg-failed-soft"
                onClick={() =>
                  ask({
                    title: "Detach Worker domain",
                    body: domain.name,
                    actionLabel: "Detach",
                    intent: "danger",
                    onConfirm: async () => {
                      await window.deployDeck.cloudflare.detachWorkerDomain(accountId, domain.id);
                      await client.invalidateQueries({ queryKey: ["worker-domains"] });
                      await client.invalidateQueries({ queryKey: ["domains"] });
                      toast.success("Domain detached");
                    },
                  })
                }
              >
                Detach
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
