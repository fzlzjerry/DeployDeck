import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  Boxes,
  Globe2,
  LayoutDashboard,
  Rocket,
  Search,
  Settings,
  SlidersHorizontal,
  Waypoints,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Screen } from "@shared/models";
import { Logo } from "@/components/common/logo";
import { Button, Kbd, SelectControl } from "@/components/ui/primitives";
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

const contentVariants = {
  enter: { opacity: 0, y: 2 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -2 },
};

const reducedContentVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

export function AppShell({ children }: { children: ReactNode }) {
  const screen = useUiStore((state) => state.screen);
  const setScreen = useUiStore((state) => state.setScreen);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const prefs = usePrefs();
  const reduce = useReducedMotion();

  return (
    <div className={cn("flex h-full", prefs.data?.density === "comfortable" ? "comfortable" : "compact")}>
      <aside className="flex w-[var(--sidebar)] shrink-0 flex-col border-r border-line bg-surface" aria-label="Workspace navigation">
        <div className="app-drag flex h-12 shrink-0 items-center gap-2 pr-3 pl-[78px]">
          <Logo className="size-5" />
          <span className="text-[13px] font-semibold tracking-[-0.015em]">DeployDeck</span>
        </div>
        <LayoutGroup>
          <nav className="app-no-drag flex flex-1 flex-col gap-0.5 px-2 py-2" aria-label="Primary">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = screen === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-8 items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors duration-150 focus-visible:z-10",
                    active ? "text-ink" : "text-muted hover:bg-bg/70 hover:text-ink",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-md bg-bg shadow-[inset_0_0_0_1px_var(--line)]"
                      transition={reduce ? { duration: 0 } : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    />
                  ) : null}
                  <Icon className={cn("relative size-3.5", active && "text-ember-ink")} strokeWidth={1.75} />
                  <span className="relative">{item.label}</span>
                </button>
              );
            })}
            <div className="mt-auto pt-2">
              <button
                type="button"
                onClick={() => setScreen("settings")}
                aria-current={screen === "settings" ? "page" : undefined}
                className={cn(
                  "relative flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors duration-150 focus-visible:z-10",
                  screen === "settings" ? "text-ink" : "text-muted hover:bg-bg/70 hover:text-ink",
                )}
              >
                {screen === "settings" ? (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-md bg-bg shadow-[inset_0_0_0_1px_var(--line)]"
                    transition={reduce ? { duration: 0 } : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  />
                ) : null}
                <Settings className={cn("relative size-3.5", screen === "settings" && "text-ember-ink")} strokeWidth={1.75} />
                <span className="relative">Settings</span>
              </button>
            </div>
          </nav>
        </LayoutGroup>
        <AccountLines onOpenSettings={() => setScreen("settings")} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-drag flex h-12 shrink-0 items-center justify-between border-b border-line pr-3 pl-4">
          <h1 id="screen-title" className="text-[13px] font-semibold tracking-[-0.01em]">
            {SCREEN_LABEL[screen]}
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="app-no-drag w-52 justify-start bg-bg text-muted"
            aria-label="Open search and command palette"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="size-3.5" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate text-left font-normal">Search workspace</span>
            <Kbd>⌘K</Kbd>
          </Button>
        </header>
        <main className="app-no-drag relative min-h-0 flex-1 overflow-hidden" aria-labelledby="screen-title">
          <AnimatePresence initial={false}>
            <motion.div
              key={screen}
              variants={reduce ? reducedContentVariants : contentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={reduce ? { duration: 0 } : { duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 overflow-hidden"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function AccountLines({ onOpenSettings }: { onOpenSettings: () => void }) {
  const connection = useConnection();
  const vercel = connection.data?.vercel;
  const cloudflare = connection.data?.cloudflare;
  const hasConnection = Boolean(vercel?.connected || cloudflare?.connected);

  return (
    <section className="app-no-drag border-t border-line px-2 py-2" aria-label="Connected accounts">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-medium text-muted">Connections</p>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted">
          <span className={cn("size-1.5 rounded-full", hasConnection ? "bg-ready" : "bg-muted")} aria-hidden />
          {hasConnection ? "Online" : "Offline"}
        </span>
      </div>
      <div className="space-y-2">
        {vercel?.connected ? (
          <div className="space-y-1">
            <p className="px-1 text-[11px] text-muted">Vercel</p>
            <SelectControl
              className="w-full"
              size="sm"
              ariaLabel="Active Vercel team"
              value={vercel.activeTeamId ?? "personal"}
              onValueChange={(value) => {
                const next = value === "personal" ? null : value;
                void window.deployDeck.connections.setVercelTeam(next);
              }}
              options={[
                { value: "personal", label: vercel.userName ?? "Personal" },
                ...vercel.teams.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          </div>
        ) : null}
        {cloudflare?.connected ? (
          <div className="space-y-1">
            <p className="px-1 text-[11px] text-muted">Cloudflare</p>
            <SelectControl
              className="w-full"
              size="sm"
              ariaLabel="Active Cloudflare account"
              value={cloudflare.activeAccountId ?? "all"}
              onValueChange={(value) => {
                const next = value === "all" ? null : value;
                void window.deployDeck.connections.setCloudflareAccount(next);
              }}
              options={[
                { value: "all", label: "All accounts" },
                ...cloudflare.accounts.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          </div>
        ) : null}
        {!hasConnection ? (
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted" onClick={onOpenSettings}>
            Open connection settings
          </Button>
        ) : null}
      </div>
    </section>
  );
}
