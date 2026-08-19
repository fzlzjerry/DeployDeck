import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InspectorList } from "./projects-screen";

describe("Project inspector lists", () => {
  it("renders its rows once instead of recursively rendering itself", () => {
    render(<InspectorList><div>Deployment row</div></InspectorList>);
    expect(screen.getAllByText("Deployment row")).toHaveLength(1);
  });
});

