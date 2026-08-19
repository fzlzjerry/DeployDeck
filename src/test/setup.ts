import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

class ResizeObserverFixture {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", { configurable: true, value: ResizeObserverFixture });
Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: ResizeObserverFixture });

if (!globalThis.PointerEvent) {
  Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: MouseEvent });
}
