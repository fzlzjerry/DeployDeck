import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Slot } from "@radix-ui/react-slot";
import { motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, LoaderCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { easeOutExpo } from "@/lib/motion";

const controlFocus =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-bg";

/*
 * Controls share one 34px rail so a toolbar of buttons, inputs, and selects
 * lines up. `sm` (28px) is the quiet in-row variant; `lg` (40px) is for the
 * first-run console and primary form submits.
 */
/*
 * Disabled filled buttons drop to a neutral surface rather than fading the
 * fill. A saturated accent at 40% opacity reads as a smudge, and it also spends
 * the one-lamp budget on a control that cannot be pressed.
 */
const disabledFill = cn(
  "disabled:bg-surface-2 disabled:text-subtle disabled:active:translate-y-0",
  "data-[disabled=true]:bg-surface-2 data-[disabled=true]:text-subtle",
);
const disabledQuiet = "disabled:opacity-45 data-[disabled=true]:opacity-45";

const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium",
    "transition-[color,background-color,border-color,opacity,transform] duration-150 ease-[var(--ease-out-expo)]",
    "disabled:pointer-events-none data-[disabled=true]:pointer-events-none",
    "motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
    controlFocus,
  ),
  {
    variants: {
      variant: {
        default: cn(
          "bg-ember text-ember-fg hover:bg-ember-hover active:translate-y-px active:bg-ember-active",
          disabledFill,
        ),
        secondary: cn("bg-surface-2 text-ink hover:bg-surface-3 active:translate-y-px", disabledQuiet),
        ghost: cn("text-ink hover:bg-surface-2 active:bg-surface-3", disabledQuiet),
        outline: cn(
          "border border-line bg-control text-ink hover:bg-control-hover active:bg-surface-2",
          disabledQuiet,
        ),
        danger: cn("bg-failed text-failed-fg hover:bg-failed-hover active:translate-y-px", disabledFill),
        destructive: cn("bg-failed text-failed-fg hover:bg-failed-hover active:translate-y-px", disabledFill),
      },
      size: {
        default: "h-[34px] px-3 text-body [&_svg]:size-4",
        sm: "h-7 px-2.5 text-dense [&_svg]:size-3.5",
        lg: "h-10 px-4 text-body [&_svg]:size-4",
        icon: "size-[34px] p-0 [&_svg]:size-4",
        "icon-sm": "size-7 p-0 [&_svg]:size-3.5",
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
        "h-[34px] w-full rounded-control border border-line bg-control px-3 text-body text-ink placeholder:text-muted",
        "transition-[color,background-color,border-color,box-shadow] duration-150 ease-[var(--ease-out-expo)]",
        "hover:border-line-strong disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-55",
        "aria-invalid:border-failed aria-invalid:ring-2 aria-invalid:ring-failed/20",
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
          "min-h-20 w-full resize-y rounded-control border border-line bg-control px-3 py-2 text-body text-ink placeholder:text-muted",
          "transition-[color,background-color,border-color,box-shadow] duration-150 ease-[var(--ease-out-expo)]",
          "hover:border-line-strong disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-55",
          "aria-invalid:border-failed aria-invalid:ring-2 aria-invalid:ring-failed/20",
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
      className={cn("text-label font-medium text-muted peer-disabled:cursor-not-allowed peer-disabled:opacity-55", className)}
      {...props}
    />
  );
});

/*
 * Every coloured variant pairs a `-soft` wash with its `-ink` text, the two
 * roles scripts/contrast.mjs verifies together. The border is the ink at low
 * alpha, so it tracks the tone without needing its own token.
 */
const badgeVariants = cva(
  cn(
    "inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2",
    "text-label font-medium",
  ),
  {
    variants: {
      variant: {
        neutral: "border-line bg-surface-2 text-muted",
        outline: "border-line bg-transparent text-muted",
        ready: "border-ready-ink/25 bg-ready-soft text-ready-ink",
        failed: "border-failed-ink/25 bg-failed-soft text-failed-ink",
        building: "border-building-ink/25 bg-building-soft text-building-ink",
        queued: "border-queued-ink/25 bg-queued-soft text-queued-ink",
        canceled: "border-canceled-ink/25 bg-canceled-soft text-canceled-ink",
        warning: "border-warning-ink/25 bg-warning-soft text-warning-ink",
        accent: "border-ember-ink/25 bg-ember-soft text-ember-ink",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps extends React.ComponentPropsWithoutRef<"span">, VariantProps<typeof badgeVariants> {
  /** Leading indicator dot, tinted to the badge's own text colour. */
  dot?: boolean;
  /** Animates the dot. Reserved for states that are actively in progress. */
  pulse?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, dot = false, pulse = false, children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full bg-current",
            pulse && "animate-pulse motion-reduce:animate-none",
          )}
        />
      ) : null}
      {children}
    </span>
  );
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

const SKELETON_WIDTHS = ["w-4/5", "w-1/2", "w-2/3", "w-1/3", "w-3/5", "w-2/5"];

/** Row-shaped loading placeholder for `.data-table` screens. */
export function TableSkeleton({
  columns = 4,
  rows = 8,
  label = "Loading",
  className,
}: {
  columns?: number;
  rows?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("px-3.5 py-2", className)} role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid h-[var(--row-h,40px)] items-center gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn("h-3", SKELETON_WIDTHS[(rowIndex + columnIndex) % SKELETON_WIDTHS.length])}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

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
          "inline-flex min-w-0 items-center justify-between gap-2 rounded-control border border-line bg-control text-left text-ink",
          "transition-[color,background-color,border-color,box-shadow] duration-150 ease-[var(--ease-out-expo)]",
          "hover:border-line-strong hover:bg-control-hover data-[placeholder]:text-muted",
          "disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none",
          controlFocus,
          size === "sm" ? "h-7 px-2 text-dense" : "h-[34px] px-3 text-body",
          className,
        )}
      >
        {/* Clip rather than wrap: a long option must not grow the control and
            break the height of the toolbar row it sits in. */}
        <span className="min-w-0 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
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
            "z-[var(--z-dropdown)] max-h-[min(320px,var(--radix-select-content-available-height))]",
            "min-w-[var(--radix-select-trigger-width)]",
            "overflow-hidden rounded-control bg-panel p-1 text-ink shadow-[var(--shadow-popover)]",
            "popover-motion origin-[var(--radix-select-content-transform-origin)]",
          )}
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "relative flex h-8 cursor-default select-none items-center rounded-md px-2 pr-7 text-dense outline-none",
                  "data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center">
                  <Check aria-hidden="true" className="size-3.5 text-ember-ink" />
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
        "relative h-5 w-9 shrink-0 rounded-full border border-line bg-surface-2 outline-none",
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
          "block size-4 translate-x-px rounded-full bg-panel shadow-[0_1px_2px_oklch(0.2_0.02_252/0.25)]",
          "transition-transform duration-150 ease-[var(--ease-out-expo)] data-[state=checked]:translate-x-[17px] motion-reduce:transition-none",
        )}
      />
    </SwitchPrimitive.Root>
  );
});

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  ariaLabel: string;
  className?: string;
  size?: "sm" | "default";
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
  size = "default",
  disabled,
}: SegmentedControlProps<T>) {
  const reduce = useReducedMotion();
  const indicatorId = React.useId();

  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      disabled={disabled}
      aria-label={ariaLabel}
      orientation="horizontal"
      loop
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-control border border-line bg-surface p-0.5",
        disabled && "opacity-45",
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(
              "relative inline-flex select-none items-center justify-center gap-1.5 rounded-[6px] font-medium",
              "outline-none transition-colors duration-150 ease-[var(--ease-out-expo)] motion-reduce:transition-none",
              "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              "disabled:pointer-events-none disabled:opacity-40",
              size === "sm" ? "h-7 px-2.5 text-label" : "h-8 px-3 text-dense",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active ? (
              <motion.span
                layoutId={indicatorId}
                aria-hidden="true"
                className="absolute inset-0 rounded-md bg-panel shadow-[inset_0_0_0_1px_var(--line)]"
                transition={reduce ? { duration: 0 } : { duration: 0.18, ease: easeOutExpo }}
              />
            ) : null}
            {Icon ? <Icon className={cn("relative size-3.5", active && "text-ember-ink")} strokeWidth={1.75} /> : null}
            <span className="relative">{option.label}</span>
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}

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
      // Scrolls rather than wraps: a wrapped label would double the height of
      // the tab bar in a narrow inspector.
      className={cn(
        "flex min-h-11 shrink-0 items-stretch gap-1 overflow-x-auto border-b border-line px-4",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
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
        "relative inline-flex h-11 shrink-0 items-center justify-center px-2.5 text-dense font-medium whitespace-nowrap text-muted outline-none",
        "transition-colors duration-150 ease-[var(--ease-out-expo)] hover:text-ink disabled:pointer-events-none disabled:opacity-40",
        "after:absolute after:inset-x-0.5 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent",
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
            "z-[var(--z-tooltip)] max-w-72 rounded-md bg-ink px-2 py-1 text-label text-bg",
            "popover-motion origin-[var(--radix-tooltip-content-transform-origin)]",
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
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line bg-surface px-1.5",
        "font-sans text-micro leading-none text-muted",
        className,
      )}
      {...props}
    />
  );
});
