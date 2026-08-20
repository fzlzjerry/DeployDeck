import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PanelRow, PanelRowButton } from "./panel";

describe("panel rows", () => {
  it("keeps static rows as div elements", () => {
    const ref = createRef<HTMLDivElement>();
    render(<PanelRow ref={ref} title="Static row" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("exposes native button semantics for interactive rows", () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    render(
      <PanelRowButton ref={ref} title="Interactive row" aria-label="Open row" disabled onClick={onClick} />,
    );

    const button = screen.getByRole("button", { name: "Open row" });
    expect(ref.current).toBe(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
