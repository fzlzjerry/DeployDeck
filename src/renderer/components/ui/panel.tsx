import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/*
 * Kumo-style layer surface: base fill, hairline ring, and a short edge shadow.
 * The ring stays crisp while the shadow only separates the surface from the
 * canvas; neither is decorative depth.
 */

export const Panel = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<"section">>(
  function Panel({ className, ...props }, ref) {
    return (
      <section
        ref={ref}
        // --table-bg keeps a nested .data-table's sticky header on the panel
        // tone instead of the canvas tone it defaults to.
        className={cn(
          "flex min-w-0 flex-col overflow-hidden rounded-panel bg-base ring-1 ring-hairline shadow-[var(--shadow-card)] [--table-bg:var(--base)]",
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

interface PanelRowContentProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Status pill, glyph, or dot shown before the title. */
  leading?: React.ReactNode;
  /** Timestamps, tallies, or actions shown at the end of the row. */
  trailing?: React.ReactNode;
  selected?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function panelRowLayout({
  description,
  selected,
  className,
}: Pick<PanelRowContentProps, "description" | "selected" | "className">) {
  return cn(
    "flex min-h-11 w-full min-w-0 gap-3 px-4 text-left",
    description ? "items-start py-3" : "items-center py-2",
    selected && "bg-brand-soft",
    className,
  );
}

function PanelRowContent({ title, description, leading, trailing, children }: PanelRowContentProps) {
  return (
    <>
      {leading ? <span className={cn("flex shrink-0 items-center", description && "h-5")}>{leading}</span> : null}
      {title !== undefined || description !== undefined ? (
        <span className="min-w-0 flex-1">
          {title !== undefined ? <span className="block truncate text-body text-ink">{title}</span> : null}
          {description !== undefined ? (
            <span className="mt-0.5 block truncate text-label text-muted">{description}</span>
          ) : null}
        </span>
      ) : null}
      {children}
      {trailing ? <span className={cn("flex shrink-0 items-center gap-3", description && "min-h-5")}>{trailing}</span> : null}
    </>
  );
}

export interface PanelRowProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "title" | "children">,
    PanelRowContentProps {}

/** Static information row inside a panel. */
export const PanelRow = React.forwardRef<HTMLDivElement, PanelRowProps>(function PanelRow(
  { title, description, leading, trailing, selected, className, children, ...props },
  ref,
) {
  return (
    <div ref={ref} className={panelRowLayout({ description, selected, className })} {...props}>
      <PanelRowContent title={title} description={description} leading={leading} trailing={trailing}>
        {children}
      </PanelRowContent>
    </div>
  );
});

export interface PanelRowButtonProps
  extends Omit<React.ComponentPropsWithoutRef<"button">, "title" | "children">,
    PanelRowContentProps {}

/** Interactive row with native button props and explicit button semantics. */
export const PanelRowButton = React.forwardRef<HTMLButtonElement, PanelRowButtonProps>(function PanelRowButton(
  { title, description, leading, trailing, selected, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        panelRowLayout({ description, selected, className }),
        "group",
        "hover:bg-tint focus-visible:bg-tint focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]",
      )}
      {...props}
    >
      <PanelRowContent title={title} description={description} leading={leading} trailing={trailing}>
        {children}
      </PanelRowContent>
    </button>
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
      <dt className="text-label text-muted">{label}</dt>
      <dd className="text-body font-semibold text-ink tabular">{value}</dd>
    </div>
  );
}

/** The strip `Readout`s live in. */
export const ReadoutStrip = React.forwardRef<HTMLDListElement, React.ComponentPropsWithoutRef<"dl">>(
  function ReadoutStrip({ className, ...props }, ref) {
    return <dl ref={ref} className={cn("flex flex-wrap items-center gap-x-6 gap-y-2", className)} {...props} />;
  },
);
