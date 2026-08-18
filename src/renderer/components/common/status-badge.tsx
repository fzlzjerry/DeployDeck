import type { DeploymentState, Provider } from "@shared/models";
import { cn } from "@/lib/cn";
import { providerLabel, stateLabel } from "@/lib/format";

const colors: Record<DeploymentState, string> = {
  queued: "bg-queued",
  building: "bg-building",
  ready: "bg-ready",
  failed: "bg-failed",
  canceled: "bg-canceled",
  unknown: "bg-muted",
};

export function StatusDot({ state }: { state: DeploymentState }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-1.5 rounded-full",
        colors[state],
        state === "building" && "animate-pulse",
      )}
    />
  );
}

export function StatusBadge({ state }: { state: DeploymentState }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]">
      <StatusDot state={state} />
      {stateLabel(state)}
    </span>
  );
}

export function ProviderMark({ provider, showIcon = true }: { provider: Provider; showIcon?: boolean }) {
  if (!showIcon) return <span>{providerLabel(provider)}</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-[4px] text-[9px] font-semibold",
          provider === "vercel" && "bg-ink text-bg",
          provider === "cloudflare-pages" && "bg-surface-3 text-ink",
          provider === "cloudflare-workers" && "border border-line bg-bg text-muted",
        )}
      >
        {provider === "vercel" ? "V" : provider === "cloudflare-pages" ? "P" : "W"}
      </span>
      {providerLabel(provider)}
    </span>
  );
}
