import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
  Boxes,
  Cloud,
  Copy,
  Gauge,
  Globe2,
  History,
  MonitorCog,
  Plus,
  RotateCcw,
  Rocket,
  Search,
  Settings,
  Waypoints,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import type { Screen, UnifiedDeployment } from "@shared/models";
import { Kbd } from "@/components/ui/primitives";
import { useConnection } from "@/hooks/use-connection";
import { useDnsZones, useProjects, useUnifiedDeployments } from "@/hooks/use-data";
import { copyText, errorMessage } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";

const SCREEN_ICONS: Record<Screen, typeof Gauge> = {
  overview: Gauge,
  deployments: Rocket,
  projects: Boxes,
  domains: Globe2,
  dns: Waypoints,
  environments: MonitorCog,
  activity: History,
  settings: Settings,
};

export function CommandPalette() {
  const open = useUiStore((state) => state.commandOpen);
  const setOpen = useUiStore((state) => state.setCommandOpen);
  const setScreen = useUiStore((state) => state.setScreen);
  const openDeployment = useUiStore((state) => state.openDeployment);
  const openProject = useUiStore((state) => state.openProject);
  const openZone = useUiStore((state) => state.openZone);
  const openCreate = useUiStore((state) => state.openCreate);
  const ask = useUiStore((state) => state.askConfirm);
  const connection = useConnection();
  const projects = useProjects();
  const deployments = useUnifiedDeployments({ provider: "all" });
  const zones = useDnsZones();
  const queryClient = useQueryClient();
  const items = deployments.data?.pages.flatMap((page) => page.items) ?? [];
  const listedProjects = [...(projects.data?.vercel ?? []), ...(projects.data?.pages ?? [])];
  const listedWorkers = projects.data?.workers ?? [];
  const latestVercel = items.find((item) => item.provider === "vercel");
  const latestPages = items.find((item) => item.provider === "cloudflare-pages");

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
      await queryClient.invalidateQueries({ queryKey: ["deployments"] });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const close = () => setOpen(false);

  const screens = useMemo(
    () =>
      [
        ["overview", "Overview"],
        ["deployments", "Deployments"],
        ["projects", "Projects"],
        ["domains", "Domains"],
        ["dns", "DNS"],
        ["environments", "Environments"],
        ["activity", "Activity"],
        ["settings", "Settings"],
      ] as Array<[Screen, string]>,
    [],
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          aria-describedby="command-description"
          className="command-content fixed top-24 left-1/2 z-[var(--z-modal)] w-[min(640px,calc(100vw-48px))] -translate-x-1/2 outline-none"
        >
          <Dialog.Title className="sr-only">Search DeployDeck</Dialog.Title>
          <Dialog.Description id="command-description" className="sr-only">
            Navigate screens, open projects and deployments, or run workspace actions.
          </Dialog.Description>
          <Command className="overflow-hidden rounded-panel bg-panel shadow-[var(--shadow-popover)]">
            <div className="flex h-13 items-center gap-2.5 border-b border-line px-4">
              <Search className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
              <Command.Input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-section text-ink outline-none placeholder:text-muted"
                placeholder="Search screens, projects, deployments…"
              />
              <Kbd>esc</Kbd>
            </div>
            <Command.List className="max-h-[440px] overflow-auto p-1.5">
              <Command.Empty className="px-3 py-12 text-center text-dense text-muted">
                No matching screen, project, or action
              </Command.Empty>
              <Command.Group heading="Navigate" className="command-group">
                {screens.map(([id, label]) => {
                  const Icon = SCREEN_ICONS[id];
                  return (
                    <Item key={id} icon={<Icon />} onSelect={() => { setScreen(id); close(); }}>
                      {label}
                    </Item>
                  );
                })}
              </Command.Group>
              <Command.Group heading="Create" className="command-group">
                <Item icon={<Plus />} detail="Vercel" onSelect={() => { openCreate("vercel-project"); close(); }}>New Vercel project</Item>
                <Item icon={<Plus />} detail="Cloudflare Pages" onSelect={() => { openCreate("pages-project"); close(); }}>New Pages project</Item>
                <Item icon={<Plus />} detail="Cloudflare Workers" onSelect={() => { openCreate("worker"); close(); }}>New Worker</Item>
                <Item icon={<Rocket />} onSelect={() => { openCreate("deployment"); close(); }}>New deployment</Item>
                <Item icon={<Waypoints />} onSelect={() => { setScreen("dns"); openCreate("dns-record"); close(); }}>New DNS record</Item>
                <Item icon={<Globe2 />} onSelect={() => { setScreen("domains"); openCreate("domain"); close(); }}>Add domain</Item>
                <Item icon={<MonitorCog />} onSelect={() => { setScreen("environments"); openCreate("environment"); close(); }}>Add environment variables</Item>
              </Command.Group>
              <Command.Group heading="Workspace" className="command-group">
                <Item icon={<MonitorCog />} onSelect={() => { void window.deployDeck.prefs.set({ theme: "system" }); close(); }}>
                  Follow system appearance
                </Item>
                <Item icon={<History />} onSelect={() => { void queryClient.invalidateQueries(); close(); }}>
                  Refresh current view
                </Item>
                {latestVercel ? (
                  <Item
                    icon={<RotateCcw />}
                    detail={latestVercel.projectName}
                    onSelect={() => {
                      close();
                      void runAction("Redeployed", () => window.deployDeck.vercel.redeploy(latestVercel.id));
                    }}
                  >
                    Redeploy latest Vercel
                  </Item>
                ) : null}
                {latestVercel ? (
                  <Item
                    icon={<Rocket />}
                    detail={latestVercel.projectName}
                    onSelect={() => {
                      close();
                      ask({
                        title: "Promote to production",
                        body: `${latestVercel.projectName} · ${latestVercel.id}`,
                        actionLabel: "Promote",
                        onConfirm: () =>
                          runAction("Promoted", () => window.deployDeck.vercel.promote(latestVercel.id, latestVercel.projectId)),
                      });
                    }}
                  >
                    Promote latest Vercel
                  </Item>
                ) : null}
                {latestVercel?.state === "ready" ? (
                  <Item
                    icon={<RotateCcw />}
                    detail={latestVercel.projectName}
                    onSelect={() => {
                      close();
                      ask({
                        title: "Instant rollback to latest ready Vercel",
                        body: `${latestVercel.projectName} · ${latestVercel.id}`,
                        actionLabel: "Roll back",
                        intent: "warning",
                        onConfirm: () =>
                          runAction("Rolled back", () => window.deployDeck.vercel.rollback(latestVercel.id, latestVercel.projectId)),
                      });
                    }}
                  >
                    Instant rollback latest Vercel
                  </Item>
                ) : null}
                {latestPages ? (
                  <Item
                    icon={<RotateCcw />}
                    detail={latestPages.projectName}
                    onSelect={() => {
                      close();
                      void runAction("Retry started", () =>
                        window.deployDeck.cloudflare.retryPagesDeployment(
                          latestPages.accountId,
                          latestPages.projectName,
                          latestPages.id,
                        ),
                      );
                    }}
                  >
                    Retry latest Pages
                  </Item>
                ) : null}
              </Command.Group>
              {listedProjects.length > 0 || listedWorkers.length > 0 ? (
                <Command.Group heading="Projects" className="command-group">
                  {listedProjects.slice(0, 12).map((project) => (
                    <Item
                      key={`${project.provider}:${project.id}`}
                      icon={<Boxes />}
                      detail={project.provider === "vercel" ? "Vercel" : "Pages"}
                      onSelect={() => {
                        openProject({ kind: "project", provider: project.provider, id: project.id });
                        close();
                      }}
                    >
                      {project.name}
                    </Item>
                  ))}
                  {listedWorkers.slice(0, 8).map((worker) => (
                    <Item
                      key={`worker:${worker.accountId}:${worker.name}`}
                      icon={<Boxes />}
                      detail="Workers"
                      onSelect={() => {
                        openProject({ kind: "worker", accountId: worker.accountId, name: worker.name });
                        close();
                      }}
                    >
                      {worker.name}
                    </Item>
                  ))}
                </Command.Group>
              ) : null}
              {items.length > 0 ? (
                <Command.Group heading="Deployments" className="command-group">
                  {items.slice(0, 12).map((item) => (
                    <Item
                      key={`${item.provider}:${item.id}`}
                      icon={<Rocket />}
                      detail={item.state}
                      onSelect={() => {
                        openDeployment(item);
                        close();
                      }}
                    >
                      {item.projectName}
                    </Item>
                  ))}
                  {items[0]?.url ? (
                    <Item icon={<Copy />} onSelect={() => { void copyText(items[0].url!); close(); }}>
                      Copy latest deployment URL
                    </Item>
                  ) : null}
                  {items.slice(0, 4).map((item) => (
                    <DeploymentCommandActions key={`actions:${item.provider}:${item.id}`} item={item} onDone={close} onRun={runAction} onAsk={ask} />
                  ))}
                </Command.Group>
              ) : null}
              {(zones.data ?? []).length > 0 ? (
                <Command.Group heading="DNS zones" className="command-group">
                  {(zones.data ?? []).slice(0, 10).map((zone) => (
                    <Item
                      key={`${zone.provider}:${zone.id}`}
                      icon={<Waypoints />}
                      onSelect={() => {
                        openZone(zone.id);
                        close();
                      }}
                    >
                      {zone.name}
                    </Item>
                  ))}
                </Command.Group>
              ) : null}
              {(connection.data?.vercel.teams.length ?? 0) + (connection.data?.cloudflare.accounts.length ?? 0) > 0 ? (
                <Command.Group heading="Accounts" className="command-group">
                  {(connection.data?.vercel.teams ?? []).map((team) => (
                    <Item key={team.id} icon={<Cloud />} onSelect={() => { void window.deployDeck.connections.setVercelTeam(team.id); close(); }}>
                      Switch to {team.name}
                    </Item>
                  ))}
                  {(connection.data?.cloudflare.accounts ?? []).map((account) => (
                    <Item key={account.id} icon={<Cloud />} onSelect={() => { void window.deployDeck.connections.setCloudflareAccount(account.id); close(); }}>
                      Switch to {account.name}
                    </Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeploymentCommandActions({
  item,
  onDone,
  onRun,
  onAsk,
}: {
  item: UnifiedDeployment;
  onDone: () => void;
  onRun: (label: string, fn: () => Promise<unknown>) => Promise<void>;
  onAsk: (confirm: {
    title: string;
    body: string;
    actionLabel: string;
    onConfirm: () => Promise<void> | void;
  }) => void;
}) {
  if (item.provider === "vercel") {
    return (
      <>
        <Item
          icon={<RotateCcw />}
          detail={item.projectName}
          onSelect={() => {
            onDone();
            void onRun("Redeployed", () => window.deployDeck.vercel.redeploy(item.id));
          }}
        >
          Redeploy {item.projectName}
        </Item>
        <Item
          icon={<Rocket />}
          detail={item.projectName}
          onSelect={() => {
            onDone();
            onAsk({
              title: "Promote to production",
              body: `${item.projectName} · ${item.id}`,
              actionLabel: "Promote",
              onConfirm: () => onRun("Promoted", () => window.deployDeck.vercel.promote(item.id, item.projectId)),
            });
          }}
        >
          Promote {item.projectName}
        </Item>
      </>
    );
  }
  if (item.provider === "cloudflare-pages") {
    return (
      <Item
        icon={<RotateCcw />}
        detail={item.projectName}
        onSelect={() => {
          onDone();
          void onRun("Retry started", () =>
            window.deployDeck.cloudflare.retryPagesDeployment(item.accountId, item.projectName, item.id),
          );
        }}
      >
        Retry {item.projectName}
      </Item>
    );
  }
  return null;
}

function Item({
  children,
  detail,
  icon,
  onSelect,
}: {
  children: ReactNode;
  detail?: string;
  icon?: ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      className="flex min-h-10 cursor-default items-center gap-2.5 rounded-md px-2.5 text-body text-ink outline-none data-[selected=true]:bg-surface-2"
      onSelect={onSelect}
    >
      {icon ? <span className="text-muted [&>svg]:size-3.5 [&>svg]:shrink-0" aria-hidden>{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {detail ? <span className="shrink-0 text-label capitalize text-subtle">{detail}</span> : null}
    </Command.Item>
  );
}
