import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Slot } from "@radix-ui/react-slot";
import { Check, ChevronDown, LoaderCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const controlFocus =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-bg";

const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium",
    "transition-[color,background-color,border-color,opacity,transform] duration-150 ease-[var(--ease-out-expo)]",
    "disabled:pointer-events-none disabled:opacity-40 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40",
    "motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
    controlFocus,
  ),
  {
    variants: {
      variant: {
        default:
          "bg-ember text-ember-fg hover:bg-ember-hover active:translate-y-px active:bg-ember-active",
        secondary: "bg-surface-2 text-ink hover:bg-surface-3 active:translate-y-px",
        ghost: "text-ink hover:bg-surface-2 active:bg-surface-3",
        outline: "border border-line bg-bg text-ink hover:bg-surface active:bg-surface-2",
        danger:
          "bg-failed text-failed-fg hover:bg-failed-hover active:translate-y-px",
        destructive:
          "bg-failed text-failed-fg hover:bg-failed-hover active:translate-y-px",
      },
      size: {
        default: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
        sm: "h-7 px-2.5 text-[12px] [&_svg]:size-3.5",
        icon: "size-8 p-0 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends Omit<React.ComponentPropsWithoutRef<"button">, "disabled">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, disabled = false, type, children, ...props },
  ref,
) {
  const blocked = disabled || loading;

  if (asChild) {
    return (
      <Slot
        className={cn(buttonVariants({ variant, size }), className)}
        aria-busy={loading || undefined}
        aria-disabled={blocked || undefined}
        data-disabled={blocked || undefined}
        data-loading={loading || undefined}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={blocked}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : null}
      {children}
    </button>
  );
});

export const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-8 w-full rounded-md border border-line bg-control px-2.5 text-[13px] text-ink placeholder:text-muted",
        "transition-[color,background-color,border-color,box-shadow] duration-150 ease-[var(--ease-out-expo)]",
        "disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-55 aria-invalid:border-failed aria-invalid:ring-failed/25",
        "motion-reduce:transition-none",
        controlFocus,
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentPropsWithoutRef<"textarea">>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-20 w-full resize-y rounded-md border border-line bg-control px-2.5 py-2 text-[13px] text-ink placeholder:text-muted",
          "transition-[color,background-color,border-color,box-shadow] duration-150 ease-[var(--ease-out-expo)]",
          "disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-55 aria-invalid:border-failed aria-invalid:ring-failed/25",
          "motion-reduce:transition-none",
          controlFocus,
          className,
        )}
        {...props}
      />
    );
  },
);

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn("text-[12px] font-medium text-muted peer-disabled:cursor-not-allowed peer-disabled:opacity-55", className)}
      {...props}
    />
  );
});

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", {
  variants: {
    variant: {
      neutral: "bg-surface-2 text-muted",
      outline: "border border-line bg-bg text-muted",
      success: "bg-ready/12 text-ready",
      warning: "bg-ember/12 text-ember",
      danger: "bg-failed/12 text-failed",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps extends React.ComponentPropsWithoutRef<"span">, VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, ...props },
  ref,
) {
  return <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
});

export const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(function Separator({ className, orientation = "horizontal", decorative = true, ...props }, ref) {
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn("shrink-0 bg-line", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
      {...props}
    />
  );
});

export const Skeleton = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(function Skeleton(
  { className, "aria-hidden": ariaHidden = true, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      aria-hidden={ariaHidden}
      className={cn("animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none", className)}
      {...props}
    />
  );
});

export interface SelectControlOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectControlProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectControlOption[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "default";
  disabled?: boolean;
  name?: string;
}

export function SelectControl({
  value,
  onValueChange,
  options,
  placeholder,
  ariaLabel,
  className,
  size = "default",
  disabled,
  name,
}: SelectControlProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled} name={name}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex min-w-0 items-center justify-between gap-2 rounded-md border border-line bg-control text-left text-ink",
          "transition-[color,background-color,border-color,box-shadow] duration-150 ease-[var(--ease-out-expo)]",
          "hover:bg-control-hover data-[placeholder]:text-muted disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none",
          controlFocus,
          size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-2.5 text-[13px]",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          className={cn(
            "z-50 max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)]",
            "overflow-hidden rounded-md bg-bg p-1 text-ink shadow-[var(--shadow-popover)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
          )}
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "relative flex h-7 cursor-default select-none items-center rounded px-2 pr-7 text-[12px] outline-none",
                  "data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center">
                  <Check aria-hidden="true" className="size-3.5 text-ember" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export interface SwitchControlProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, "onCheckedChange"> {
  onCheckedChange?: (checked: boolean) => void;
  ariaLabel?: string;
}

export const SwitchControl = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  SwitchControlProps
>(function SwitchControl({ className, ariaLabel, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      aria-label={ariaLabel}
      className={cn(
        "relative h-[18px] w-8 shrink-0 rounded-full border border-line bg-surface-2 outline-none",
        "transition-[background-color,border-color,box-shadow] duration-150 ease-[var(--ease-out-expo)]",
        "data-[state=checked]:border-ember data-[state=checked]:bg-ember disabled:cursor-not-allowed disabled:opacity-40",
        "motion-reduce:transition-none",
        controlFocus,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-3.5 translate-x-px rounded-full bg-bg",
          "transition-transform duration-150 ease-[var(--ease-out-expo)] data-[state=checked]:translate-x-[15px] motion-reduce:transition-none",
        )}
      />
    </SwitchPrimitive.Root>
  );
});

export interface CheckboxControlProps
  extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, "onCheckedChange"> {
  onCheckedChange?: (checked: boolean) => void;
  ariaLabel?: string;
}

export const CheckboxControl = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  CheckboxControlProps
>(function CheckboxControl({ className, ariaLabel, checked, onCheckedChange, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      onCheckedChange={(next) => onCheckedChange?.(next === true)}
      aria-label={ariaLabel}
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-[4px] border border-line bg-bg text-ember-fg outline-none",
        "transition-[background-color,border-color,box-shadow] duration-150 ease-[var(--ease-out-expo)]",
        "data-[state=checked]:border-ember data-[state=checked]:bg-ember data-[state=indeterminate]:border-ember",
        "disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none",
        controlFocus,
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center">
        <Check aria-hidden="true" className="size-3" strokeWidth={2.5} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn("flex min-h-9 items-end gap-1 border-b border-line px-2", className)}
      {...props}
    />
  );
});

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "relative inline-flex h-9 items-center justify-center px-2 text-[12px] font-medium text-muted outline-none",
        "transition-colors duration-150 ease-[var(--ease-out-expo)] hover:text-ink disabled:pointer-events-none disabled:opacity-40",
        "after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent",
        "data-[state=active]:text-ink data-[state=active]:after:bg-ember motion-reduce:transition-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset",
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn("min-h-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", className)}
      {...props}
    />
  );
});

export function TooltipProvider({
  delayDuration = 400,
  skipDelayDuration = 100,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}

export interface TooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["side"];
  align?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["align"];
  sideOffset?: number;
  delayDuration?: number;
  contentClassName?: string;
}

export function Tooltip({
  children,
  content,
  side = "top",
  align = "center",
  sideOffset = 6,
  delayDuration,
  contentClassName,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={8}
          className={cn(
            "z-50 max-w-64 rounded-md bg-ink px-2 py-1 text-[11px] leading-4 text-bg",
            "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out",
            contentClassName,
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const Kbd = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<"kbd">>(function Kbd(
  { className, ...props },
  ref,
) {
  return (
    <kbd
      ref={ref}
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-[4px] border border-line bg-surface px-1 py-0.5",
        "font-sans text-[10px] leading-none text-muted",
        className,
      )}
      {...props}
    />
  );
});
