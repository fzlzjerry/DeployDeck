import type { DeploymentState, Provider } from "@shared/models";
import { ProviderGlyph, type ProviderBrand } from "@/components/common/provider-glyph";
import { Badge, type BadgeProps } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { providerLabel, stateLabel } from "@/lib/format";

const dotColor: Record<DeploymentState, string> = {
  queued: "bg-queued",
  building: "bg-building",
  ready: "bg-ready",
  failed: "bg-failed",
  canceled: "bg-canceled",
  unknown: "bg-muted",
};

const badgeVariant: Record<DeploymentState, NonNullable<BadgeProps["variant"]>> = {
  queued: "queued",
  building: "building",
  ready: "ready",
  failed: "failed",
  canceled: "canceled",
  unknown: "neutral",
};

export function StatusDot({ state }: { state: DeploymentState }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        dotColor[state],
        state === "building" && "animate-pulse motion-reduce:animate-none",
      )}
    />
  );
}

export interface StatusBadgeProps {
  state: DeploymentState;
  /** `plain` drops the pill for rows where density beats emphasis. */
  variant?: "pill" | "plain";
  className?: string;
}

/**
 * Deployment state as a pill: wash, matching ink, and a dot. Composed on the
 * shared Badge so status reads the same here, in tables, and in inspectors
 * rather than being a one-off dot with bare text.
 */
export function StatusBadge({ state, variant = "pill", className }: StatusBadgeProps) {
  if (variant === "plain") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-body", className)}>
        <StatusDot state={state} />
        {stateLabel(state)}
      </span>
    );
  }

  return (
    <Badge variant={badgeVariant[state]} dot pulse={state === "building"} className={className}>
      {stateLabel(state)}
    </Badge>
  );
}

const brandFor: Record<Provider, ProviderBrand> = {
  vercel: "vercel",
  "cloudflare-pages": "cloudflare",
  "cloudflare-workers": "cloudflare",
};

/**
 * Real brand geometry rather than a letter in a box. The glyph inherits the
 * row's own tone, so provider identity never spends the one warm accent.
 */
export function ProviderMark({ provider, showIcon = true }: { provider: Provider; showIcon?: boolean }) {
  if (!showIcon) return <span>{providerLabel(provider)}</span>;
  const brand = brandFor[provider];

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <ProviderGlyph
        brand={brand}
        className={cn("size-3.5 shrink-0", brand === "cloudflare" ? "text-ember-ink" : "text-ink")}
      />
      <span className="truncate">{providerLabel(provider)}</span>
    </span>
  );
}
