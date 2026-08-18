import { cn } from "@/lib/cn";

/**
 * A stacked deck with a single lit indicator above it. Chassis takes
 * currentColor and the bars are cut from the page background, so the mark
 * inverts correctly between themes; only the indicator stays warm.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-10 text-ink", className)} aria-hidden focusable="false">
      <rect width="64" height="64" rx="15" fill="currentColor" />
      <rect x="14" y="38" width="36" height="6" rx="2" fill="var(--bg)" opacity="0.45" />
      <rect x="16" y="29" width="32" height="6" rx="2" fill="var(--bg)" opacity="0.7" />
      <rect x="18" y="20" width="28" height="6" rx="2" fill="var(--bg)" opacity="0.95" />
      <path d="M32 9.5 36.5 16.5 27.5 16.5Z" fill="var(--ember)" />
    </svg>
  );
}
