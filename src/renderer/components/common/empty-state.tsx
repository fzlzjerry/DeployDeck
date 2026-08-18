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
}

export function EmptyState({ title, body, action, icon, className, size = "default" }: EmptyStateProps) {
  const inline = size === "inline";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        inline ? "gap-1 px-4 py-6" : "h-full min-h-40 px-8",
        className,
      )}
    >
      {inline ? null : (
        <span
          className="mb-3 grid size-8 place-items-center rounded-md bg-surface-2 text-muted [&>svg]:size-4"
          aria-hidden
        >
          {icon ?? <Inbox />}
        </span>
      )}
      <p className={cn("font-medium", inline ? "text-[12px] text-ink" : "text-[14px]")}>{title}</p>
      {body ? (
        <p className={cn("max-w-[44ch] text-pretty text-muted", inline ? "text-[12px] leading-4" : "mt-1 text-[12px] leading-5")}>
          {body}
        </p>
      ) : null}
      {action ? (
        <Button size="sm" className={inline ? "mt-2" : "mt-3"} onClick={action.onClick}>
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
}: {
  message: string;
  onRetry?: () => void;
  size?: EmptyStateProps["size"];
}) {
  return (
    <div role="alert">
      <EmptyState
        size={size}
        title="Couldn't load this view"
        body={message}
        icon={<TriangleAlert />}
        action={onRetry ? { label: "Retry", onClick: onRetry } : undefined}
      />
    </div>
  );
}
