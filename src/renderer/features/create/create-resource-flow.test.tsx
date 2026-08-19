import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES, type ConnectionStatus } from "@shared/models";
import { CreateResourceFlow } from "./create-resource-flow";

const connection: ConnectionStatus = {
  vercel: { connected: true, userName: "Fixture", teams: [], activeTeamId: null },
  cloudflare: {
    connected: false,
    capabilities: {
      pages: false,
      pagesWrite: false,
      workers: false,
      workersWrite: false,
      workerBuilds: false,
      workerSchedules: false,
      zones: false,
      dns: false,
      dnsWrite: false,
      workerRoutes: false,
      workerTail: false,
    },
    accounts: [],
    activeAccountId: null,
  },
  oauth: { vercel: true, cloudflare: true },
};

describe("resource creation flow", () => {
  it("walks through source, environment variables, and review without submitting", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "deployDeck", {
      configurable: true,
      value: {
        on: vi.fn(() => () => undefined),
        files: { releaseLocalSource: vi.fn() },
      },
    });
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(["connection"], connection);
    client.setQueryData(["prefs"], DEFAULT_PREFERENCES);
    client.setQueryData(["projects", true, false, false, null, null], { vercel: [], pages: [], workers: [] });

    render(<QueryClientProvider client={client}><CreateResourceFlow kind="vercel-project" /></QueryClientProvider>);
    await user.type(screen.getByPlaceholderText("my-project"), "fixture-project");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(screen.getByPlaceholderText("owner/repository"), "fixture/repository");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Environment" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("VARIABLE_NAME"), "api_key");
    await user.type(screen.getByPlaceholderText("Value"), "fixture-value");
    await user.click(screen.getByRole("button", { name: "Add variable" }));
    expect(screen.getByText("API_KEY")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByText("1 variable")).toBeInTheDocument();
  });
});
