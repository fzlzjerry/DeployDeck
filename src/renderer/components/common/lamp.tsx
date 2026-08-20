import { cn } from "@/lib/cn";

export type LampState = "off" | "verifying" | "live" | "fault";

const LAMP_LABEL: Record<LampState, string> = {
  off: "Idle",
  verifying: "Verifying",
  live: "Live",
  fault: "Rejected",
};

/**
 * A panel indicator. Dark and inert until something real happens, then it
 * carries the state itself: amber while a token is being checked, green once
 * the channel is live. The bloom is what makes it read as lit rather than
 * as a coloured dot, so it scales with the state.
 */
export function Lamp({ state, className }: { state: LampState; className?: string }) {
  return (
    <span
      className={cn(
        // A bezel that is visible even when nothing is lit, so an unlit lamp
        // still reads as a lamp rather than as absence.
        "relative grid size-4 shrink-0 place-items-center rounded-full bg-surface-sunken",
        "shadow-[inset_0_0_0_1px_var(--line),inset_0_1px_1px_oklch(0_0_0/0.25)]",
        className,
      )}
      aria-hidden
    >
      <span
        className={cn(
          "size-[6px] rounded-full transition-[background-color,box-shadow] duration-300 ease-[var(--ease-out-expo)]",
          "motion-reduce:transition-none",
          state === "off" && "bg-subtle/45 shadow-none",
          state === "verifying" &&
            "animate-pulse bg-ember shadow-[0_0_9px_2px_var(--lamp-glow)] motion-reduce:animate-none",
          state === "live" &&
            "bg-ready-lamp shadow-[0_0_10px_2px_color-mix(in_oklch,var(--ready-lamp)_55%,transparent)]",
          state === "fault" && "bg-failed shadow-[0_0_9px_2px_color-mix(in_oklch,var(--failed)_50%,transparent)]",
        )}
      />
    </span>
  );
}

/** Lamp plus a monospaced state word: the readout on a panel. */
export function LampReadout({ state, className }: { state: LampState; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2", className)}>
      <Lamp state={state} />
      <span
        role="status"
        aria-live="polite"
        className={cn(
          "font-mono text-micro",
          // The `-ink` roles, not the lamp fills: this is text, and it can land
          // on a sunken bezel where the fills are not verified.
          state === "live" ? "text-ready-ink" : state === "fault" ? "text-failed-ink" : "text-subtle",
        )}
      >
        {LAMP_LABEL[state]}
      </span>
    </span>
  );
}

/** A row of lamps mirroring each channel, for an at-a-glance panel readout. */
export function LampBank({ states, className }: { states: LampState[]; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2 py-1.5",
        "shadow-[inset_0_0_0_1px_var(--line)]",
        className,
      )}
      aria-hidden
    >
      {states.map((state, index) => (
        <Lamp key={index} state={state} className="size-3 shadow-none" />
      ))}
    </span>
  );
}
