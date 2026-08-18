import { Inbox, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-40 flex-col items-center justify-center px-8 text-center", className)}>
      <span className="mb-3 grid size-8 place-items-center rounded-md bg-surface-2 text-muted [&>svg]:size-4" aria-hidden>
        {icon ?? <Inbox />}
      </span>
      <p className="text-[14px] font-medium">{title}</p>
      {body ? <p className="mt-1 max-w-[44ch] text-[12px] leading-5 text-muted text-pretty">{body}</p> : null}
      {action ? (
        <Button size="sm" className="mt-3" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function ScreenError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      title="Couldn't load this view"
      body={message}
      icon={<TriangleAlert />}
      action={onRetry ? { label: "Retry", onClick: onRetry } : undefined}
    />
  );
}
