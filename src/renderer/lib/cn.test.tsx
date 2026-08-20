import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps DeployDeck text sizes and colours as separate utilities", () => {
    expect(cn("text-bg", "text-dense")).toContain("text-bg");
    expect(cn("text-bg", "text-dense")).toContain("text-dense");
    expect(cn("text-body", "text-ink")).toContain("text-body");
    expect(cn("text-body", "text-ink")).toContain("text-ink");
  });

  it("still resolves actual colour conflicts", () => {
    expect(cn("text-muted", "text-ink")).toBe("text-ink");
  });
});
