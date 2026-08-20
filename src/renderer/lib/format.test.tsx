import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatWhen } from "./format";

describe("formatWhen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("uses compact relative time within seven days", () => {
    expect(formatWhen("2026-08-20T11:58:00Z", "relative")).toBe("2m ago");
    expect(formatWhen("2026-08-20T07:00:00Z", "relative")).toBe("5h ago");
    expect(formatWhen("2026-08-16T12:00:00Z", "relative")).toBe("4d ago");
  });

  it("uses a stable date after seven days", () => {
    expect(formatWhen("2026-08-01T12:00:00Z", "relative")).toBe("Aug 1, 2026");
    expect(formatWhen("2028-03-15T12:00:00Z", "relative")).toBe("Mar 15, 2028");
  });
});
