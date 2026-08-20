import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * Tailwind Merge cannot infer project-defined `--text-*` theme keys. Without
 * this extension it treats `text-dense` as a colour and drops either the type
 * scale or `text-ink` / `text-ember-fg` depending on class order.
 */
const mergeClasses = extendTailwindMerge({
  extend: {
    theme: {
      text: ["micro", "label", "dense", "body", "section", "title", "console"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return mergeClasses(clsx(inputs));
}
