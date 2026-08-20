import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
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
 * Kumo-style screen header directly under the drag bar. It owns the base
 * surface and bottom hairline; resource filters then live inside their card.
 */
export const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(function PageHeader(
  { title, description, meta, actions, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("flex shrink-0 items-start justify-between gap-4 border-b border-hairline bg-base px-6 py-4", className)}
      {...props}
    >
      <div className="min-w-0">
        <h1
          id="screen-title"
          className="truncate text-title font-semibold text-balance text-ink"
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
          "flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-base px-4 py-2",
          className,
        )}
        {...props}
      />
    );
  },
);

/** Canvas padding and height contract for Kumo-style resource list surfaces. */
export const ResourceListFrame = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function ResourceListFrame({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("flex min-h-0 flex-1 flex-col px-6 pt-4 pb-6", className)}
        {...props}
      />
    );
  },
);

const inspectorPanelVariants = cva("inspector-panel flex min-h-0 shrink-0 flex-col border-l border-line bg-bg", {
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
    VariantProps<typeof inspectorPanelVariants> {
  onDismiss?: () => void;
  returnFocusTo?: HTMLElement | null;
}

function captureInspectorReturnFocus(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) return active;
  return document.querySelector<HTMLElement>(
    '.data-table [aria-selected="true"], .data-table [tabindex="0"], button[aria-current="page"]',
  );
}

function restoreInspectorFocus(preferred: HTMLElement | null): void {
  const fallback = captureInspectorReturnFocus();
  (preferred?.isConnected ? preferred : fallback)?.focus();
}

export const InspectorPanel = React.forwardRef<HTMLElement, InspectorPanelProps>(function InspectorPanel(
  { className, size, onDismiss, returnFocusTo, children, "aria-label": ariaLabel, ...props },
  ref,
) {
  const [overlay, setOverlay] = React.useState(() => window.matchMedia("(max-width: 1399px)").matches);
  const returnFocus = React.useRef<HTMLElement | null>(returnFocusTo ?? captureInspectorReturnFocus());
  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 1399px)");
    const update = () => setOverlay(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  React.useEffect(() => {
    const target = returnFocus.current;
    return () => {
      window.setTimeout(() => restoreInspectorFocus(target), 0);
    };
  }, []);

  const aside = (
    <aside
      ref={ref}
      aria-label={ariaLabel}
      className={cn(inspectorPanelVariants({ size }), className)}
      {...props}
    >
      {children}
    </aside>
  );

  if (!overlay || !onDismiss) return aside;

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          const target = returnFocus.current;
          onDismiss();
          window.setTimeout(() => restoreInspectorFocus(target), 0);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-[var(--overlay)]" />
        <Dialog.Content
          asChild
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            window.setTimeout(() => restoreInspectorFocus(returnFocus.current), 0);
          }}
        >
          {React.cloneElement(aside, {
            className: cn(
              aside.props.className,
              "fixed inset-y-0 right-0 z-[var(--z-modal)] w-[min(560px,calc(100vw-32px))] border-l-0 bg-panel shadow-[var(--shadow-popover)]",
            ),
            style: { ...aside.props.style, width: "min(560px, calc(100vw - 32px))" },
            children: (
              <>
                <Dialog.Title className="sr-only">{typeof ariaLabel === "string" ? ariaLabel : "Details"}</Dialog.Title>
                {children}
              </>
            ),
          })}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
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
  React.useEffect(() => {
    if (!onClose) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

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
