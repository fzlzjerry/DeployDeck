import { cn } from "@/lib/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-10 text-ink", className)} aria-hidden>
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <rect x="14" y="38" width="36" height="6" rx="1.5" fill="oklch(0.78 0.13 85)" />
      <rect x="16" y="29" width="32" height="6" rx="1.5" fill="oklch(0.88 0.08 85)" />
      <rect x="18" y="20" width="28" height="6" rx="1.5" fill="oklch(0.96 0.04 85)" />
      <path d="M32 10 L36 16 H28 Z" fill="oklch(0.78 0.13 85)" />
    </svg>
  );
}
