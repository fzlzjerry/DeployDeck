import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";

/**
 * One menu vocabulary for both the right-click and the dropdown surfaces, so a
 * "Copy value" item cannot look different depending on how it was opened.
 */
const menuContentClass = cn(
  "z-[var(--z-dropdown)] min-w-48 overflow-hidden rounded-control bg-panel p-1 text-dense text-ink",
  "shadow-[var(--shadow-popover)] popover-motion",
);

const menuItemClass = cn(
  "flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-dense outline-none",
  "transition-colors duration-100 ease-[var(--ease-out-expo)] motion-reduce:transition-none",
  "data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
);

const menuSeparatorClass = "-mx-1 my-1 h-px bg-line";

export const ContextMenuContent = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(function ContextMenuContent({ className, ...props }, ref) {
  return (
    <ContextMenuPrimitive.Content
      ref={ref}
      collisionPadding={8}
      className={cn(menuContentClass, "origin-[var(--radix-context-menu-content-transform-origin)]", className)}
      {...props}
    />
  );
});

export const ContextMenuItem = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & { destructive?: boolean }
>(function ContextMenuItem({ className, destructive, ...props }, ref) {
  return (
    <ContextMenuPrimitive.Item
      ref={ref}
      className={cn(menuItemClass, destructive && "text-failed-ink data-[highlighted]:bg-failed-soft", className)}
      {...props}
    />
  );
});

export const ContextMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(function ContextMenuSeparator({ className, ...props }, ref) {
  return <ContextMenuPrimitive.Separator ref={ref} className={cn(menuSeparatorClass, className)} {...props} />;
});

export const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 4, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(menuContentClass, "origin-[var(--radix-dropdown-menu-content-transform-origin)]", className)}
      {...props}
    />
  );
});

export const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }
>(function DropdownMenuItem({ className, destructive, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(menuItemClass, destructive && "text-failed-ink data-[highlighted]:bg-failed-soft", className)}
      {...props}
    />
  );
});

export const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return <DropdownMenuPrimitive.Separator ref={ref} className={cn(menuSeparatorClass, className)} {...props} />;
});
