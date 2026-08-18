import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import {
  Boxes,
  Cloud,
  Copy,
  Gauge,
  Globe2,
  History,
  MonitorCog,
  Rocket,
  Search,
  Settings,
  Waypoints,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import type { Screen } from "@shared/models";
import { Kbd } from "@/components/ui/primitives";
import { useConnection } from "@/hooks/use-connection";
import { useProjects, useUnifiedDeployments, useZones } from "@/hooks/use-data";
import { copyText } from "@/lib/format";
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
  const connection = useConnection();
  const projects = useProjects();
  const deployments = useUnifiedDeployments({ provider: "all" });
  const zones = useZones();
  const items = deployments.data?.pages.flatMap((page) => page.items) ?? [];

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
        <Dialog.Overlay className="modal-overlay z-40" />
        <Dialog.Content
          aria-describedby="command-description"
          className="command-content fixed top-24 left-1/2 z-50 w-[min(600px,calc(100vw-48px))] -translate-x-1/2 outline-none"
        >
          <Dialog.Title className="sr-only">Search DeployDeck</Dialog.Title>
          <Dialog.Description id="command-description" className="sr-only">
            Navigate screens, open projects and deployments, or run workspace actions.
          </Dialog.Description>
          <Command className="overflow-hidden rounded-xl bg-bg shadow-[var(--shadow-popover)]">
            <div className="flex h-12 items-center gap-2.5 border-b border-line px-3">
              <Search className="size-4 text-muted" aria-hidden />
              <Command.Input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
                placeholder="Search screens, projects, deployments…"
              />
              <Kbd>esc</Kbd>
            </div>
            <Command.List className="max-h-[420px] overflow-auto p-1.5">
              <Command.Empty className="px-3 py-10 text-center text-[12px] text-muted">
                No matching screen, project, or action
              </Command.Empty>
              <Command.Group heading="Navigate" className="command-group">
                {screens.map(([id, label]) => {
                  const Icon = SCREEN_ICONS[id];
                  return (
                    <Item key={id} icon={<Icon />} onSelect={() => { setScreen(id); setOpen(false); }}>
                      {label}
                    </Item>
                  );
                })}
              </Command.Group>
              <Command.Group heading="Workspace" className="command-group">
                <Item icon={<MonitorCog />} onSelect={() => { void window.deployDeck.prefs.set({ theme: "system" }); setOpen(false); }}>
                  Follow system appearance
                </Item>
                <Item icon={<History />} onSelect={() => window.location.reload()}>
                  Refresh current view
                </Item>
              </Command.Group>
              {[...(projects.data?.vercel ?? []), ...(projects.data?.pages ?? [])].length > 0 ? (
                <Command.Group heading="Projects" className="command-group">
                  {[...(projects.data?.vercel ?? []), ...(projects.data?.pages ?? [])].slice(0, 12).map((project) => (
                    <Item
                      key={`${project.provider}:${project.id}`}
                      icon={<Boxes />}
                      detail={project.provider === "vercel" ? "Vercel" : "Cloudflare"}
                      onSelect={() => {
                        setScreen("projects");
                        setOpen(false);
                      }}
                    >
                      {project.name}
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
                        setOpen(false);
                      }}
                    >
                      {item.projectName}
                    </Item>
                  ))}
                  {items[0]?.url ? (
                    <Item icon={<Copy />} onSelect={() => { void copyText(items[0].url!); setOpen(false); }}>
                      Copy latest deployment URL
                    </Item>
                  ) : null}
                </Command.Group>
              ) : null}
              {(zones.data ?? []).length > 0 ? (
                <Command.Group heading="DNS zones" className="command-group">
                  {(zones.data ?? []).slice(0, 10).map((zone) => (
                    <Item key={zone.id} icon={<Waypoints />} onSelect={() => { setScreen("dns"); setOpen(false); }}>
                      {zone.name}
                    </Item>
                  ))}
                </Command.Group>
              ) : null}
              {(connection.data?.vercel.teams.length ?? 0) + (connection.data?.cloudflare.accounts.length ?? 0) > 0 ? (
                <Command.Group heading="Accounts" className="command-group">
                  {(connection.data?.vercel.teams ?? []).map((team) => (
                    <Item key={team.id} icon={<Cloud />} onSelect={() => { void window.deployDeck.connections.setVercelTeam(team.id); setOpen(false); }}>
                      Switch to {team.name}
                    </Item>
                  ))}
                  {(connection.data?.cloudflare.accounts ?? []).map((account) => (
                    <Item key={account.id} icon={<Cloud />} onSelect={() => { void window.deployDeck.connections.setCloudflareAccount(account.id); setOpen(false); }}>
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
      className="flex min-h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-[13px] text-ink outline-none data-[selected=true]:bg-surface-2"
      onSelect={onSelect}
    >
      {icon ? <span className="text-muted [&>svg]:size-3.5 [&>svg]:shrink-0" aria-hidden>{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {detail ? <span className="shrink-0 text-[11px] capitalize text-subtle">{detail}</span> : null}
    </Command.Item>
  );
}
