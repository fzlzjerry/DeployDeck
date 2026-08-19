import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/*
 * A panel is a raised surface on the recessed canvas: 1px hairline plus one
 * tonal step, never a border paired with a wide drop shadow. Only portal
 * surfaces (dialogs, menus) are allowed to carry the popover shadow.
 */

export const Panel = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<"section">>(
  function Panel({ className, ...props }, ref) {
    return (
      <section
        ref={ref}
        // --table-bg keeps a nested .data-table's sticky header on the panel
        // tone instead of the canvas tone it defaults to.
        className={cn(
          "flex min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-panel [--table-bg:var(--panel)]",
          className,
        )}
        {...props}
      />
    );
  },
);

export interface PanelHeaderProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Rendered next to the title as a quiet tally. */
  count?: number;
  actions?: React.ReactNode;
  /** `sm` steps the title down for panels nested inside another panel. */
  size?: "sm" | "default";
}

export const PanelHeader = React.forwardRef<HTMLDivElement, PanelHeaderProps>(function PanelHeader(
  { title, description, count, actions, size = "default", className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex shrink-0 items-center justify-between gap-4 border-b border-line bg-panel-header px-4",
        description ? "py-2.5" : "min-h-11 py-2",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <h2
          className={cn(
            "flex min-w-0 items-center gap-2 font-semibold text-balance text-ink",
            size === "sm" ? "text-body" : "text-section",
          )}
        >
          <span className="truncate">{title}</span>
          {typeof count === "number" ? (
            <span className="shrink-0 font-normal text-muted tabular">{count}</span>
          ) : null}
        </h2>
        {description ? (
          <p className="mt-0.5 max-w-[65ch] text-pretty text-dense text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
});

const panelBodyVariants = cva("min-w-0", {
  variants: {
    padding: {
      none: "",
      default: "p-4",
      tight: "px-4 py-3",
    },
    scroll: {
      true: "min-h-0 flex-1 overflow-auto",
      false: "",
    },
    divided: {
      true: "divide-y divide-line/70",
      false: "",
    },
  },
  defaultVariants: { padding: "default", scroll: false, divided: false },
});

export interface PanelBodyProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof panelBodyVariants> {}

export const PanelBody = React.forwardRef<HTMLDivElement, PanelBodyProps>(function PanelBody(
  { className, padding, scroll, divided, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn(panelBodyVariants({ padding, scroll, divided }), className)} {...props} />
  );
});

/** Bottom bar for pagination, tallies, and one trailing action. */
export const PanelFooter = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function PanelFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-panel-header px-4 py-2",
          className,
        )}
        {...props}
      />
    );
  },
);

export interface PanelRowProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Status pill, glyph, or dot shown before the title. */
  leading?: React.ReactNode;
  /** Timestamps, tallies, or actions shown at the end of the row. */
  trailing?: React.ReactNode;
  /** Turns the row into a button. Adds hover, focus, and press affordances. */
  onActivate?: () => void;
  activateLabel?: string;
  selected?: boolean;
}

/**
 * One row inside a panel. Replaces the hand-rolled
 * `-mx-2 flex min-h-10 … hover:bg-surface` pattern that had drifted across
 * the overview, inspector, and activity surfaces.
 */
export const PanelRow = React.forwardRef<HTMLDivElement, PanelRowProps>(function PanelRow(
  {
    title,
    description,
    leading,
    trailing,
    onActivate,
    activateLabel,
    selected,
    className,
    children,
    ...props
  },
  ref,
) {
  const layout = cn(
    "flex min-h-11 w-full min-w-0 items-center gap-3 px-4 text-left",
    description ? "py-2.5" : "py-2",
    selected && "bg-ember-soft",
    className,
  );

  const content = (
    <>
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      {title !== undefined || description !== undefined ? (
        <span className="min-w-0 flex-1">
          {title !== undefined ? <span className="block truncate text-body text-ink">{title}</span> : null}
          {description !== undefined ? (
            <span className="mt-0.5 block truncate text-label text-muted">{description}</span>
          ) : null}
        </span>
      ) : null}
      {children}
      {trailing ? <span className="flex shrink-0 items-center gap-3">{trailing}</span> : null}
    </>
  );

  if (onActivate) {
    return (
      <button
        type="button"
        aria-label={activateLabel}
        onClick={onActivate}
        className={cn(
          layout,
          "group transition-colors duration-150 ease-[var(--ease-out-expo)] motion-reduce:transition-none",
          "hover:bg-surface focus-visible:bg-surface focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div ref={ref} className={layout} {...props}>
      {content}
    </div>
  );
});

export interface ReadoutProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Status dot colour. Omit for a plain readout. */
  tone?: "ready" | "failed" | "building" | "queued" | "neutral";
}

const toneDot: Record<NonNullable<ReadoutProps["tone"]>, string> = {
  ready: "bg-ready",
  failed: "bg-failed",
  building: "bg-building",
  queued: "bg-queued",
  neutral: "bg-muted",
};

/**
 * A single label/value pair in a horizontal readout strip. Deliberately not a
 * metric card: PRODUCT.md rules out giant metric tiles and uptime theatre.
 */
export function Readout({ label, value, tone }: ReadoutProps) {
  return (
    <div className="flex items-center gap-2">
      {tone ? <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", toneDot[tone])} /> : null}
      <dt className="text-dense text-muted">{label}</dt>
      <dd className="text-dense font-medium text-ink tabular">{value}</dd>
    </div>
  );
}

/** The strip `Readout`s live in. */
export const ReadoutStrip = React.forwardRef<HTMLDListElement, React.ComponentPropsWithoutRef<"dl">>(
  function ReadoutStrip({ className, ...props }, ref) {
    return <dl ref={ref} className={cn("flex flex-wrap items-center gap-x-6 gap-y-2", className)} {...props} />;
  },
);
