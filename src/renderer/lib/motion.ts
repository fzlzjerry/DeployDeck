import type { Transition, Variants } from "motion/react";

export const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const quick: Transition = { duration: 0.14, ease: easeOutExpo };
export const stateChange: Transition = { duration: 0.18, ease: easeOutExpo };
export const stepChange: Transition = { duration: 0.22, ease: easeOutExpo };

export function stepVariants(direction: number): Variants {
  return {
    enter: { opacity: 0, x: direction * 12 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: direction * -8 },
  };
}

export function screenVariants(direction: number): Variants {
  return {
    enter: { opacity: 0, y: direction >= 0 ? 3 : -3 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: direction >= 0 ? -2 : 2 },
  };
}

export const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};
