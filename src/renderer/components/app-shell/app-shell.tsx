import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  Boxes,
  ChevronsUpDown,
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
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CreateResourceKind, Screen } from "@shared/models";
import { Logo } from "@/components/common/logo";
import { rememberCommandPaletteTrigger } from "@/components/common/command-palette";
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
  "relative flex h-9 w-full items-center gap-2.5 rounded-control text-left text-body focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

const COMPACT_SHELL_QUERY = "(max-width: 1099px)";

export function AppShell({ children }: { children: ReactNode }) {
  const screen = useUiStore((state) => state.screen);
  const setScreen = useUiStore((state) => state.setScreen);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const openCreate = useUiStore((state) => state.openCreate);
  const prefs = usePrefs();
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();
  const [narrow, setNarrow] = useState(() => window.matchMedia(COMPACT_SHELL_QUERY).matches);
  const collapsed = narrow || Boolean(prefs.data?.sidebarCollapsed);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_SHELL_QUERY);
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
          "flex shrink-0 flex-col overflow-hidden border-r border-hairline bg-elevated",
          collapsed ? "w-16" : "w-[var(--sidebar)]",
        )}
        aria-label="Workspace navigation"
      >
        <div className="app-drag shrink-0">
          <div className="h-12" />
          <div className={cn("flex items-center pb-3", collapsed ? "justify-center px-2" : "gap-2.5 px-3") }>
            <Logo className="size-5 shrink-0" />
            {!collapsed ? <span className="text-body font-semibold">DeployDeck</span> : null}
          </div>
        </div>
        <AccountLines collapsed={collapsed} onOpenSettings={() => setScreen("settings")} />
        <LayoutGroup>
          <nav className={cn("app-no-drag flex flex-1 flex-col gap-0.5 py-2", collapsed ? "px-2" : "px-3")} aria-label="Primary">
            <div className="mb-2">
              <NewMenu onSelect={chooseCreate} collapsed={collapsed} />
            </div>
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
        <header className="app-drag flex h-[var(--titlebar)] shrink-0 items-center justify-end gap-2 bg-base px-6">
          <Tooltip content="Search workspace">
            <Button
              variant="outline"
              size="sm"
              className="app-no-drag justify-start text-muted"
              aria-label="Open search and command palette"
              onClick={(event) => {
                rememberCommandPaletteTrigger(event.currentTarget);
                setCommandOpen(true);
              }}
            >
              <Search strokeWidth={1.75} />
              <span className="font-normal">Search</span>
              <Kbd className="-mr-0.5">⌘K</Kbd>
            </Button>
          </Tooltip>
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
        active ? "text-ink" : "text-muted hover:bg-tint hover:text-ink",
      )}
    >
      {active ? (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 rounded-control bg-base shadow-[inset_0_0_0_1px_var(--hairline)]"
          transition={reduce ? { duration: 0 } : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        />
      ) : null}
      <Icon className="relative size-4" strokeWidth={1.75} />
      {!collapsed ? <span className="relative">{label}</span> : null}
    </button>
  );
  return collapsed ? <Tooltip content={label} side="right">{button}</Tooltip> : button;
}

function NewMenu({ onSelect, collapsed = false }: { onSelect: (kind: CreateResourceKind) => void; collapsed?: boolean }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const trigger = (
    <Button
      ref={triggerRef}
      size={collapsed ? "icon" : "default"}
      variant="outline"
      className={cn("app-no-drag", !collapsed && "w-full justify-start")}
      aria-label={collapsed ? "New resource" : undefined}
      title={collapsed ? "New resource" : undefined}
    >
      <Plus aria-hidden />
      {!collapsed ? "New resource" : null}
    </Button>
  );
  const menu = (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenuContent
        align="start"
        className="min-w-52"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          window.setTimeout(() => triggerRef.current?.focus(), 0);
        }}
      >
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
  return menu;
}

function AccountLines({ collapsed, onOpenSettings }: { collapsed: boolean; onOpenSettings: () => void }) {
  const connection = useConnection();
  const vercel = connection.data?.vercel;
  const cloudflare = connection.data?.cloudflare;
  const hasConnection = Boolean(vercel?.connected || cloudflare?.connected);
  const connectedCount = Number(Boolean(vercel?.connected)) + Number(Boolean(cloudflare?.connected));
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "app-no-drag mb-2 rounded-control bg-base text-left text-ink outline-none ring-1 ring-hairline hover:bg-tint focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            collapsed ? "mx-2 grid size-10 place-items-center" : "mx-3 flex h-11 w-[calc(100%-1.5rem)] items-center gap-2.5 px-2.5",
          )}
          aria-label="Workspace accounts"
        >
          <span className="relative grid size-6 shrink-0 place-items-center rounded-md bg-recessed text-muted">
            <Cloud className="size-3.5" aria-hidden />
            <span className={cn("absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-panel", hasConnection ? "bg-ready" : "bg-muted")} />
          </span>
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium">Workspace</span>
                <span className="block truncate text-label text-muted">
                  {connectedCount ? `${connectedCount} provider${connectedCount === 1 ? "" : "s"}` : "No provider connected"}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 text-muted" aria-hidden />
            </>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side={collapsed ? "right" : "bottom"} align="start" sideOffset={8} collisionPadding={8} className="z-[var(--z-dropdown)] w-72 rounded-panel bg-panel p-3 shadow-[var(--shadow-popover)]">
          <AccountControls onOpenSettings={onOpenSettings} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
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
