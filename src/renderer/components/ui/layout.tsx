import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { Button, Label } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export const ScreenToolbar = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function ScreenToolbar({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2", className)}
        {...props}
      />
    );
  },
);

const inspectorPanelVariants = cva("flex min-h-0 shrink-0 flex-col border-l border-line bg-bg", {
  variants: {
    size: {
      sm: "w-[min(320px,42vw)]",
      md: "w-[min(440px,46vw)]",
      lg: "w-[min(520px,52vw)]",
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
      className={cn("flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-2", className)}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="truncate text-[13px] font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 truncate text-[11px] text-muted">{subtitle}</p> : null}
      </div>
      {actions || onClose ? (
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {onClose ? (
            <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label={closeLabel}>
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
}

export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(function SectionHeader(
  { title, description, actions, className, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn("flex items-start justify-between gap-4", className)} {...props}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-5 text-ink text-wrap-balance">{title}</h2>
        {description ? <p className="mt-1 max-w-[65ch] text-[12px] leading-5 text-muted text-wrap-pretty">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
});

export interface SettingsSectionProps extends Omit<React.ComponentPropsWithoutRef<"section">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
}

export const SettingsSection = React.forwardRef<HTMLElement, SettingsSectionProps>(function SettingsSection(
  { title, description, children, className, ...props },
  ref,
) {
  return (
    <section ref={ref} className={cn("max-w-2xl space-y-3", className)} {...props}>
      <SectionHeader title={title} description={description} />
      <div className="divide-y divide-line/70 overflow-hidden rounded-lg border border-line bg-surface/45">{children}</div>
    </section>
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
      className={cn("flex min-h-12 items-center justify-between gap-6 px-3 py-2.5", className)}
      {...props}
    >
      <div className="min-w-0">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="block text-[13px] text-ink">
            {label}
          </Label>
        ) : (
          <div className="text-[13px] font-medium text-ink">{label}</div>
        )}
        {description ? <p className="mt-0.5 max-w-[52ch] text-[11px] leading-4 text-muted">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
});
