import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  Boxes,
  Cloud,
  Globe2,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Rocket,
  Search,
  Settings,
  SlidersHorizontal,
  Waypoints,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { CreateResourceKind, Screen } from "@shared/models";
import { Logo } from "@/components/common/logo";
import { PageHeader } from "@/components/ui/layout";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/menu";
import { Button, Kbd, SelectControl, Tooltip } from "@/components/ui/primitives";
import { useConnection, usePrefs } from "@/hooks/use-connection";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/ui-store";

const NAV: Array<{ id: Screen; label: string; icon: typeof Rocket }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "deployments", label: "Deployments", icon: Rocket },
  { id: "projects", label: "Projects", icon: Boxes },
  { id: "domains", label: "Domains", icon: Globe2 },
  { id: "dns", label: "DNS", icon: Waypoints },
  { id: "environments", label: "Environments", icon: SlidersHorizontal },
  { id: "activity", label: "Activity", icon: Activity },
];

const SCREEN_LABEL: Record<Screen, string> = {
  overview: "Overview",
  deployments: "Deployments",
  projects: "Projects",
  domains: "Domains",
  dns: "DNS",
  environments: "Environments",
  activity: "Activity",
  settings: "Settings",
};

const SCREEN_DESCRIPTION: Record<Screen, string> = {
  overview: "What is building, what failed, and what shipped across your connected providers.",
  deployments: "Create, inspect, promote, retry, and roll back deployments across every provider.",
  projects: "Manage the full lifecycle of Vercel projects, Pages sites, and Workers.",
  domains: "Attach, verify, redirect, and move domains across projects and zones.",
  dns: "Manage Cloudflare and Vercel authoritative DNS records.",
  environments: "Environment variables and secrets, one project and target at a time.",
  activity: "Local operations plus recently fetched deployments. Not a provider audit log.",
  settings: "Manage providers, workspace behavior, uploads, and deployment signals.",
};

const navRow =
  "relative flex h-9 w-full items-center gap-2.5 rounded-control text-left text-body transition-colors duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] motion-reduce:transition-none";

export function AppShell({ children }: { children: ReactNode }) {
  const screen = useUiStore((state) => state.screen);
  const setScreen = useUiStore((state) => state.setScreen);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const openCreate = useUiStore((state) => state.openCreate);
  const prefs = usePrefs();
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 1180px)").matches);
  const collapsed = narrow || Boolean(prefs.data?.sidebarCollapsed);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1180px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const chooseCreate = (kind: CreateResourceKind) => {
    if (kind === "domain") {
      setScreen("domains");
      openCreate(kind);
      return;
    }
    if (kind === "environment") {
      setScreen("environments");
      openCreate(kind);
      return;
    }
    if (kind === "dns-record") setScreen("dns");
    openCreate(kind);
  };

  return (
    <div className={cn("flex h-full", prefs.data?.density === "comfortable" ? "comfortable" : "compact") }>
      <aside
        data-collapsed={collapsed || undefined}
        className={cn(
          "flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-[var(--ease-out-expo)] motion-reduce:transition-none",
          collapsed ? "w-16" : "w-[232px]",
        )}
        aria-label="Workspace navigation"
      >
        <div className="app-drag shrink-0">
          <div className="h-12" />
          <div className={cn("flex items-center pb-3", collapsed ? "justify-center px-2" : "gap-2.5 px-3") }>
            <Logo className="size-5 shrink-0" />
            {!collapsed ? <span className="text-body font-semibold tracking-[-0.015em]">DeployDeck</span> : null}
          </div>
        </div>
        <LayoutGroup>
          <nav className={cn("app-no-drag flex flex-1 flex-col gap-0.5 py-2", collapsed ? "px-2" : "px-3")} aria-label="Primary">
            {NAV.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={screen === item.id}
                collapsed={collapsed}
                reduce={Boolean(reduce)}
                onClick={() => setScreen(item.id)}
              />
            ))}
            <div className="mt-auto pt-2">
              <NavItem icon={Settings} label="Settings" active={screen === "settings"} collapsed={collapsed} reduce={Boolean(reduce)} onClick={() => setScreen("settings")} />
            </div>
          </nav>
        </LayoutGroup>
        <AccountLines collapsed={collapsed} onOpenSettings={() => setScreen("settings")} />
        {!narrow ? (
          <div className={cn("app-no-drag border-t border-line p-2", collapsed ? "flex justify-center" : "") }>
            <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              <Button
                variant="ghost"
                size={collapsed ? "icon-sm" : "sm"}
                className={collapsed ? undefined : "w-full justify-start text-muted"}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={async () => {
                  const next = await window.deployDeck.prefs.set({ sidebarCollapsed: !collapsed });
                  queryClient.setQueryData(["prefs"], next);
                }}
              >
                {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
                {!collapsed ? "Collapse sidebar" : null}
              </Button>
            </Tooltip>
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-drag flex h-12 shrink-0 items-center justify-end gap-2 px-6">
          <NewMenu onSelect={chooseCreate} />
          <Button
            variant="outline"
            className="app-no-drag w-64 justify-start text-muted"
            aria-label="Open search and command palette"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="size-4" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate text-left font-normal">Search workspace</span>
            <Kbd>⌘K</Kbd>
          </Button>
        </header>
        <PageHeader title={SCREEN_LABEL[screen]} description={SCREEN_DESCRIPTION[screen]} />
        <main className="app-no-drag relative min-h-0 flex-1 overflow-hidden" aria-labelledby="screen-title">
          <div key={screen} className="absolute inset-0 overflow-hidden">{children}</div>
        </main>
      </div>
    </div>
  );
}
function NavItem({ icon: Icon, label, active, collapsed, reduce, onClick }: {
  icon: typeof Rocket;
  label: string;
  active: boolean;
  collapsed: boolean;
  reduce: boolean;
  onClick: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        navRow,
        collapsed ? "justify-center px-0" : "px-2.5",
        active ? "text-ink" : "text-muted hover:bg-bg/70 hover:text-ink",
      )}
    >
      {active ? (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 rounded-control bg-panel shadow-[inset_0_0_0_1px_var(--line)]"
          transition={reduce ? { duration: 0 } : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        />
      ) : null}
      <Icon className={cn("relative size-4", active && "text-ember-ink")} strokeWidth={1.75} />
      {!collapsed ? <span className="relative">{label}</span> : null}
    </button>
  );
  return collapsed ? <Tooltip content={label} side="right">{button}</Tooltip> : button;
}

function NewMenu({ onSelect }: { onSelect: (kind: CreateResourceKind) => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size="sm" className="app-no-drag"><Plus aria-hidden /> New</Button>
      </DropdownMenu.Trigger>
      <DropdownMenuContent align="end" className="min-w-52" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DropdownMenuItem onSelect={() => onSelect("vercel-project")}><Boxes aria-hidden /> Vercel project</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect("pages-project")}><Cloud aria-hidden /> Pages project</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect("worker")}><Cloud aria-hidden /> Worker</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect("deployment")}><Rocket aria-hidden /> Deployment</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onSelect("domain")}><Globe2 aria-hidden /> Domain</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect("dns-record")}><Waypoints aria-hidden /> DNS record</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect("environment")}><SlidersHorizontal aria-hidden /> Environment variables</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu.Root>
  );
}

function AccountLines({ collapsed, onOpenSettings }: { collapsed: boolean; onOpenSettings: () => void }) {
  const connection = useConnection();
  const vercel = connection.data?.vercel;
  const cloudflare = connection.data?.cloudflare;
  const hasConnection = Boolean(vercel?.connected || cloudflare?.connected);
  const content = <AccountControls onOpenSettings={onOpenSettings} />;

  if (collapsed) {
    return (
      <Popover.Root>
        <Popover.Trigger asChild>
          <button type="button" className="app-no-drag mx-2 mb-2 grid h-9 place-items-center rounded-control text-muted outline-none hover:bg-bg/70 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" aria-label="Connected accounts">
            <span className="relative"><Cloud className="size-4" aria-hidden /><span className={cn("absolute -right-1 -bottom-1 size-2 rounded-full border border-surface", hasConnection ? "bg-ready" : "bg-muted")} /></span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="right" align="end" sideOffset={8} collisionPadding={8} className="z-[var(--z-dropdown)] w-64 rounded-panel bg-panel p-3 shadow-[var(--shadow-popover)]">
            {content}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }

  return <section className="app-no-drag border-t border-line px-3 py-3" aria-label="Connected accounts">{content}</section>;
}

function AccountControls({ onOpenSettings }: { onOpenSettings: () => void }) {
  const connection = useConnection();
  const vercel = connection.data?.vercel;
  const cloudflare = connection.data?.cloudflare;
  const hasConnection = Boolean(vercel?.connected || cloudflare?.connected);
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-label font-medium text-muted">Connections</p>
        <span className="inline-flex items-center gap-1.5 text-label text-muted"><span className={cn("size-1.5 rounded-full", hasConnection ? "bg-ready" : "bg-muted")} aria-hidden />{hasConnection ? "Online" : "Offline"}</span>
      </div>
      <div className="space-y-2.5">
        {vercel?.connected ? (
          <div className="space-y-1"><p className="text-label text-subtle">Vercel</p><SelectControl className="w-full" size="sm" ariaLabel="Active Vercel team" value={vercel.activeTeamId ?? "personal"} onValueChange={(value) => void window.deployDeck.connections.setVercelTeam(value === "personal" ? null : value)} options={[{ value: "personal", label: vercel.userName ?? "Personal" }, ...vercel.teams.map((item) => ({ value: item.id, label: item.name }))]} /></div>
        ) : null}
        {cloudflare?.connected ? (
          <div className="space-y-1"><p className="text-label text-subtle">Cloudflare</p><SelectControl className="w-full" size="sm" ariaLabel="Active Cloudflare account" value={cloudflare.activeAccountId ?? "all"} onValueChange={(value) => void window.deployDeck.connections.setCloudflareAccount(value === "all" ? null : value)} options={[{ value: "all", label: "All accounts" }, ...cloudflare.accounts.map((item) => ({ value: item.id, label: item.name }))]} /></div>
        ) : null}
        {!hasConnection ? <Button variant="ghost" size="sm" className="w-full justify-start text-muted" onClick={onOpenSettings}>Open connection settings</Button> : null}
      </div>
    </>
  );
}
