import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/lib/motion";

export interface StepDefinition {
  id: string;
  label: string;
  /** Blocks Continue until true. Undefined means the step is always satisfied. */
  complete?: boolean;
}

/**
 * Drives a stepped flow with GSAP. Content leaves before the next step mounts,
 * so the two never overlap, and the stage height is tweened between measured
 * values to stop the footer jumping between steps of different sizes.
 *
 * Every step renders its rows with `data-row`; those are what stagger.
 */
export function useStepFlow(steps: StepDefinition[]) {
  const [index, setIndex] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const direction = useRef(1);
  const fromHeight = useRef(0);
  const busy = useRef(false);

  const move = useCallback(
    (next: number, dir: number) => {
      if (busy.current || next === index || next < 0 || next >= steps.length) return;
      const node = stage.current;
      if (!node) {
        setIndex(next);
        return;
      }

      busy.current = true;
      direction.current = dir;
      fromHeight.current = node.offsetHeight;

      const rows = gsap.utils.toArray<HTMLElement>("[data-row]", node);
      const reduce = prefersReducedMotion();

      gsap.timeline({ onComplete: () => setIndex(next) }).to(rows.length ? rows : node, {
        autoAlpha: 0,
        y: reduce ? 0 : dir * -10,
        duration: reduce ? 0.01 : 0.2,
        stagger: reduce ? 0 : { each: 0.028, from: dir > 0 ? "start" : "end" },
        ease: "power2.in",
      });
    },
    [index, steps.length],
  );

  useGSAP(
    () => {
      const node = stage.current;
      if (!node) return;

      const rows = gsap.utils.toArray<HTMLElement>("[data-row]", node);
      const target = node.scrollHeight;
      const previous = fromHeight.current;
      const reduce = prefersReducedMotion();

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(node, { clearProps: "height" });
          busy.current = false;
        },
      });

      // Height is a layout property, but nothing else keeps the footer from
      // jumping when steps differ in size, so it is tweened between measured
      // values rather than left to snap.
      if (previous && !reduce) {
        tl.fromTo(node, { height: previous }, { height: target, duration: 0.42, ease: "power3.out" }, 0);
      }

      tl.fromTo(
        rows.length ? rows : node,
        { autoAlpha: 0, y: reduce ? 0 : direction.current * 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: reduce ? 0.01 : 0.5,
          stagger: reduce ? 0 : { each: 0.06, from: "start" },
          ease: "power3.out",
          clearProps: "transform",
        },
        previous && !reduce ? 0.06 : 0,
      );
    },
    { dependencies: [index], scope: stage },
  );

  const current = steps[index];
  return {
    stage,
    index,
    current,
    isFirst: index === 0,
    isLast: index === steps.length - 1,
    canAdvance: current?.complete !== false,
    next: () => move(index + 1, 1),
    back: () => move(index - 1, -1),
    goTo: (target: number) => move(target, target > index ? 1 : -1),
  };
}

/**
 * Segmented progress. Reads as a level meter on the panel rather than as dots,
 * and completed steps stay navigable.
 */
export function StepMeter({
  steps,
  index,
  onSelect,
}: {
  steps: StepDefinition[];
  index: number;
  onSelect: (target: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduce = prefersReducedMotion();
      gsap.utils.toArray<HTMLElement>("[data-fill]", root.current).forEach((fill, position) => {
        gsap.to(fill, {
          scaleX: position <= index ? 1 : 0,
          duration: reduce ? 0 : 0.5,
          ease: "power3.out",
        });
      });
    },
    { dependencies: [index], scope: root },
  );

  return (
    <div ref={root} className="flex items-center gap-4" role="list" aria-label="Setup progress">
      {steps.map((step, position) => {
        const done = position < index;
        const active = position === index;
        return (
          <button
            key={step.id}
            type="button"
            role="listitem"
            aria-current={active ? "step" : undefined}
            disabled={position > index}
            onClick={() => onSelect(position)}
            className={cn(
              "group flex min-w-0 flex-1 flex-col gap-1.5 text-left outline-none",
              "disabled:cursor-default focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              "rounded-[3px] focus-visible:ring-offset-4 focus-visible:ring-offset-bg",
            )}
          >
            <span className="relative h-[3px] w-full overflow-hidden rounded-full bg-surface-2">
              <span
                data-fill
                className={cn(
                  "absolute inset-0 origin-left rounded-full",
                  active ? "bg-brand" : done ? "bg-ready" : "bg-transparent",
                )}
                style={{ transform: "scaleX(0)" }}
              />
            </span>
            <span
              className={cn(
                "truncate font-mono text-micro",
                active ? "text-ink" : done ? "text-muted group-hover:text-ink" : "text-subtle",
              )}
            >
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
