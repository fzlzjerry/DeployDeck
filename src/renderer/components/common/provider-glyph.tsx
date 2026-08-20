import { cn } from "@/lib/cn";

export type ProviderBrand = "vercel" | "cloudflare";

/**
 * Real brand geometry instead of a letter in a box. Both marks are drawn in
 * currentColor so they inherit whatever tone the surrounding row uses.
 */
export function ProviderGlyph({ brand, className }: { brand: ProviderBrand; className?: string }) {
  if (brand === "vercel") {
    return (
      <svg viewBox="0 0 24 24" className={cn("size-4", className)} aria-hidden focusable="false">
        <path d="M12 3.6 22.2 20.4H1.8Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={cn("size-4", className)} aria-hidden focusable="false">
      <path
        d="M16.9 17.6H5.6a3.4 3.4 0 0 1-.5-6.76 5.5 5.5 0 0 1 10.48-1.5 3.6 3.6 0 0 1 1.32 8.26Z"
        fill="currentColor"
      />
      <path
        d="M17.6 17.6a3.6 3.6 0 0 0 1.1-6.9 4 4 0 0 1 3.5 3.94 3.9 3.9 0 0 1-.6 2.06 1.6 1.6 0 0 1-1.3.9Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  );
}

/** The bezelled tile a glyph sits in on the setup console. */
export function ProviderTile({ brand, className }: { brand: ProviderBrand; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-control bg-bg",
        brand === "cloudflare" ? "text-ember-ink" : "text-ink",
        "shadow-[inset_0_0_0_1px_var(--line)]",
        className,
      )}
      aria-hidden
    >
      <ProviderGlyph brand={brand} className="size-[18px]" />
    </span>
  );
}
