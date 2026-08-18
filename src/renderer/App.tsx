import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell/app-shell";
import { CommandPalette } from "@/components/common/command-palette";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Logo } from "@/components/common/logo";
import { ActivityScreen } from "@/features/activity/activity-screen";
import { DeploymentsScreen } from "@/features/deployments/deployments-screen";
import { DnsScreen } from "@/features/dns/dns-screen";
import { DomainsScreen } from "@/features/domains/domains-screen";
import { EnvironmentsScreen } from "@/features/environments/environments-screen";
import { CompactConnect, SetupGuide } from "@/features/onboarding/setup-guide";
import { OverviewScreen } from "@/features/overview/overview-screen";
import { ProjectsScreen } from "@/features/projects/projects-screen";
import { SettingsScreen } from "@/features/settings/settings-screen";
import { useConnection, usePrefs } from "@/hooks/use-connection";
import { useHostEvents } from "@/hooks/use-host-events";
import { easeOutExpo, fadeVariants, stateChange } from "@/lib/motion";
import { useUiStore } from "@/stores/ui-store";

export function App() {
  const connection = useConnection();
  const prefs = usePrefs();
  const screen = useUiStore((state) => state.screen);
  const setScreen = useUiStore((state) => state.setScreen);
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [forceSetup, setForceSetup] = useState(false);
  useHostEvents();

  useEffect(() => {
    if (prefs.data?.defaultScreen) setScreen(prefs.data.defaultScreen);
  }, [prefs.data?.defaultScreen, setScreen]);

  useEffect(() => {
    const theme = prefs.data?.theme ?? "system";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [prefs.data?.theme]);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!window.deployDeck) return;
    return window.deployDeck.on("host:connection-changed", () => {
      void queryClient.invalidateQueries({ queryKey: ["connection"] });
    });
  }, [queryClient]);

  const connected = Boolean(connection.data?.vercel.connected || connection.data?.cloudflare.connected);

  const finishSetup = async () => {
    await window.deployDeck.prefs.set({ setupComplete: true });
    void queryClient.invalidateQueries({ queryKey: ["prefs"] });
    setForceSetup(false);
  };

  const booting = !prefs.isSuccess || (Boolean(window.deployDeck) && connection.isLoading);
  const showSetup = forceSetup || Boolean(prefs.data && !prefs.data.setupComplete && !connected);
  const showConnect = Boolean(prefs.data?.setupComplete && !connected && !forceSetup);

  let mode = "app";
  if (booting) mode = "boot";
  else if (showSetup) mode = "setup";
  else if (showConnect) mode = "connect";

  return (
    <div className="relative h-full bg-bg text-ink">
      {offline ? (
        <div
          role="status"
          className="absolute top-14 right-4 z-30 flex items-center gap-2 rounded-md bg-surface-2 px-3 py-1.5 text-[12px] text-muted"
        >
          <WifiOff className="size-3.5" aria-hidden />
          Offline · showing cached session data
        </div>
      ) : null}
      <AnimatePresence mode="sync">
        <motion.div
          key={mode}
          variants={fadeVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={reduce ? { duration: 0.12 } : stateChange}
          className="absolute inset-0"
        >
          {mode === "boot" ? <BootScreen /> : null}
          {mode === "setup" ? <SetupGuide onFinished={() => void finishSetup()} /> : null}
          {mode === "connect" ? <CompactConnect onReplaySetup={() => setForceSetup(true)} /> : null}
          {mode === "app" ? (
            <AppShell>
              {screen === "overview" && <OverviewScreen />}
              {screen === "deployments" && <DeploymentsScreen />}
              {screen === "projects" && <ProjectsScreen />}
              {screen === "domains" && <DomainsScreen />}
              {screen === "dns" && <DnsScreen />}
              {screen === "environments" && <EnvironmentsScreen />}
              {screen === "activity" && <ActivityScreen />}
              {screen === "settings" && <SettingsScreen onReplaySetup={() => setForceSetup(true)} />}
            </AppShell>
          ) : null}
        </motion.div>
      </AnimatePresence>
      <CommandPalette />
      <ConfirmDialog />
      <Toaster
        className="dd-toaster"
        position="bottom-right"
        theme={prefs.data?.theme ?? "system"}
        closeButton
        gap={8}
      />
    </div>
  );
}

function BootScreen() {
  const reduce = useReducedMotion();
  const [showIndicator, setShowIndicator] = useState(false);

  // A fast boot should look instant, not flash a loading state for one frame.
  useEffect(() => {
    const timer = window.setTimeout(() => setShowIndicator(true), 150);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="app-drag flex h-full items-center justify-center bg-bg">
      <motion.div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 text-muted"
        initial={false}
        animate={{ opacity: showIndicator ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.2, ease: easeOutExpo }}
      >
        <Logo className="size-8" />
        <span className="text-[13px]">Opening workspace…</span>
      </motion.div>
    </div>
  );
}
