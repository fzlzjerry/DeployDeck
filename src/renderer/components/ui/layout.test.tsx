import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { InspectorHeader, InspectorPanel } from "./layout";

describe("Inspector sheet", () => {
  it("uses the shared responsive class and closes on Escape", async () => {
    const close = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <InspectorPanel><InspectorHeader title="Details" onClose={close} /></InspectorPanel>,
    );
    expect(container.querySelector(".inspector-panel")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Close inspector" })).toBeInTheDocument();
  });

  it("returns focus to the trigger when the inspector closes", async () => {
    const user = userEvent.setup();
    function Fixture() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open details</button>{open ? <InspectorPanel><InspectorHeader title="Details" onClose={() => setOpen(false)} /></InspectorPanel> : null}</>;
    }
    render(<Fixture />);
    const trigger = screen.getByRole("button", { name: "Open details" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Close inspector" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
