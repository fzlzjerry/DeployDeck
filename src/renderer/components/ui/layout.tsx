import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { Panel, PanelBody, PanelHeader, type PanelHeaderProps } from "@/components/ui/panel";
import { Button, Label } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export interface PageHeaderProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Tallies or status readouts, aligned with the title baseline. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * The screen title block. Sits directly under the drag bar on the canvas, with
 * no hairline of its own: the toolbar (or content) below supplies the division,
 * so a screen never stacks three horizontal rules before its first row.
 */
export const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(function PageHeader(
  { title, description, meta, actions, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("flex shrink-0 items-start justify-between gap-4 px-6 pt-1 pb-4", className)}
      {...props}
    >
      <div className="min-w-0">
        <h1
          id="screen-title"
          className="truncate text-title font-semibold tracking-[-0.02em] text-balance text-ink"
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-[70ch] text-pretty text-dense text-muted">{description}</p>
        ) : null}
      </div>
      {meta || actions ? (
        <div className="flex shrink-0 items-center gap-3 pt-0.5">
          {meta}
          {actions}
        </div>
      ) : null}
    </div>
  );
});

export const ScreenToolbar = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function ScreenToolbar({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-line px-6 py-2.5",
          className,
        )}
        {...props}
      />
    );
  },
);

const inspectorPanelVariants = cva("flex min-h-0 shrink-0 flex-col border-l border-line bg-bg", {
  variants: {
    size: {
      sm: "w-[min(340px,42vw)]",
      md: "w-[min(460px,46vw)]",
      lg: "w-[min(540px,52vw)]",
    },
  },
  defaultVariants: { size: "md" },
});

export interface InspectorPanelProps
  extends React.ComponentPropsWithoutRef<"aside">,
    VariantProps<typeof inspectorPanelVariants> {}

export const InspectorPanel = React.forwardRef<HTMLElement, InspectorPanelProps>(function InspectorPanel(
  { className, size, ...props },
  ref,
) {
  return <aside ref={ref} className={cn(inspectorPanelVariants({ size }), className)} {...props} />;
});

export interface InspectorHeaderProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}

export const InspectorHeader = React.forwardRef<HTMLDivElement, InspectorHeaderProps>(function InspectorHeader(
  { title, subtitle, actions, onClose, closeLabel = "Close inspector", className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2", className)}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="truncate text-section font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 truncate text-label text-muted">{subtitle}</p> : null}
      </div>
      {actions || onClose ? (
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {onClose ? (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label={closeLabel}>
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

export interface SectionHeaderProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** `sm` steps the heading down so sections sit below a screen title. */
  size?: "sm" | "default";
}

export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(function SectionHeader(
  { title, description, actions, size = "default", className, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn("flex items-start justify-between gap-4", className)} {...props}>
      <div className="min-w-0">
        <h2
          className={cn("font-semibold text-balance text-ink", size === "sm" ? "text-body" : "text-section")}
        >
          {title}
        </h2>
        {description ? (
          <p className={cn("max-w-[65ch] text-pretty text-dense text-muted", size === "sm" ? "mt-0.5" : "mt-1")}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
});

export interface SettingsSectionProps extends Omit<React.ComponentPropsWithoutRef<"section">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  size?: PanelHeaderProps["size"];
}

export const SettingsSection = React.forwardRef<HTMLElement, SettingsSectionProps>(
  function SettingsSection({ title, description, actions, size, children, className, ...props }, ref) {
    // Width is the page container's call, not the section's, so sections stay
    // flush with the screen title above them.
    return (
      <Panel ref={ref} className={className} {...props}>
        <PanelHeader title={title} description={description} actions={actions} size={size} />
        <PanelBody padding="none" divided>
          {children}
        </PanelBody>
      </Panel>
    );
  },
);

export interface DetailRowProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  label: React.ReactNode;
  value: React.ReactNode;
  mono?: boolean;
}

/** Label/value pair for inspector panels. Render inside a <dl>. */
export const DetailRow = React.forwardRef<HTMLDivElement, DetailRowProps>(function DetailRow(
  { label, value, mono = false, className, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn("grid grid-cols-[132px_minmax(0,1fr)] gap-3 py-2", className)} {...props}>
      <dt className="text-dense text-muted">{label}</dt>
      <dd className={cn("min-w-0 break-words select-text", mono ? "font-mono text-dense" : "text-body")}>
        {value}
      </dd>
    </div>
  );
});

export interface SettingRowProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
}

export const SettingRow = React.forwardRef<HTMLDivElement, SettingRowProps>(function SettingRow(
  { label, description, htmlFor, children, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("flex min-h-14 items-center justify-between gap-6 px-4 py-3", className)}
      {...props}
    >
      <div className="min-w-0">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="block text-body text-ink">
            {label}
          </Label>
        ) : (
          <div className="text-body font-medium text-ink">{label}</div>
        )}
        {description ? <p className="mt-0.5 max-w-[56ch] text-dense text-muted">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
});
