import { Inbox, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  icon?: ReactNode;
  className?: string;
  /** `inline` fits inside an inspector panel or a section instead of filling a screen. */
  size?: "inline" | "default";
  /** Draws a container around the state, for when it stands alone on the canvas. */
  framed?: boolean;
}

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
  size = "default",
  framed = false,
}: EmptyStateProps) {
  const inline = size === "inline";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        inline ? "gap-1 px-4 py-8" : "h-full min-h-48 px-8 py-10",
        framed && "rounded-panel border border-line bg-panel",
        className,
      )}
    >
      {/* The inline size keeps its icon: an inspector empty that is only a line
          of centred text reads as a rendering failure rather than a state. */}
      <span
        className={cn(
          "grid place-items-center rounded-panel bg-surface-2 text-muted",
          inline ? "mb-2 size-8 [&>svg]:size-4" : "mb-3.5 size-10 [&>svg]:size-5",
        )}
        aria-hidden
      >
        {icon ?? <Inbox strokeWidth={1.75} />}
      </span>
      <p className={cn("font-semibold text-ink", inline ? "text-body" : "text-section")}>{title}</p>
      {body ? (
        <p className={cn("max-w-[52ch] text-pretty text-dense text-muted", inline ? "mt-1" : "mt-1.5")}>
          {body}
        </p>
      ) : null}
      {action ? (
        <Button size={inline ? "sm" : "default"} className={inline ? "mt-3" : "mt-4"} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function ScreenError({
  message,
  onRetry,
  size,
  framed,
}: {
  message: string;
  onRetry?: () => void;
  size?: EmptyStateProps["size"];
  framed?: boolean;
}) {
  return (
    <div role="alert" className={size === "inline" ? undefined : "h-full"}>
      <EmptyState
        size={size}
        framed={framed}
        title="Couldn't load this view"
        body={message}
        icon={<TriangleAlert strokeWidth={1.75} />}
        action={onRetry ? { label: "Retry", onClick: onRetry } : undefined}
      />
    </div>
  );
}
