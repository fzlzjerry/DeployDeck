import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./primitives";

describe("Button", () => {
  it("keeps a loading action focusable and blocks duplicate activation", () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save changes</Button>);

    const button = screen.getByRole("button", { name: "Save changes" });
    button.focus();
    expect(button).toHaveFocus();
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
