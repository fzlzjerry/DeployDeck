import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createDnsRecordDraft } from "@shared/dns-records";
import { DnsRecordEditor, DnsTypePicker, previewBindZone } from "./dns-screen";

describe("DNS type picker", () => {
  it("shows every Cloudflare record type and filters Vercel-only choices", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<DnsTypePicker provider="cloudflare" value="A" onValueChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "DNS record type" }));
    expect(screen.getByRole("button", { name: /OPENPGPKEY/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /TLSA/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    rerender(<DnsTypePicker provider="vercel" value="A" onValueChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "DNS record type" }));
    expect(screen.getByRole("button", { name: /ALIAS/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /TLSA/ })).not.toBeInTheDocument();
  });
});

describe("DNS record editor", () => {
  it("renders structured fields for advanced TLSA records", () => {
    const draft = createDnsRecordDraft("TLSA", "example.com");
    render(
      <DnsRecordEditor
        zone={{
          id: "zone",
          provider: "cloudflare",
          accountId: "account",
          accountName: "Account",
          name: "example.com",
          status: "active",
          nameServers: [],
        }}
        state={{ draft }}
        canWrite
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("Certificate usage")).toBeInTheDocument();
    expect(screen.getByText("Selector")).toBeInTheDocument();
    expect(screen.getByText("Matching type")).toBeInTheDocument();
    expect(screen.getByText("Certificate association")).toBeInTheDocument();
  });
});

describe("BIND import preview", () => {
  it("counts recognizable rows and reports name/type conflicts before import", () => {
    const preview = previewBindZone(
      "$ORIGIN example.com.\n@ 300 IN A 192.0.2.1\nwww 300 IN CNAME target.example.com.\nmail 300 IN MX 10 mail.example.com.",
      "example.com",
      [{
        id: "1",
        provider: "cloudflare",
        zoneId: "zone",
        zoneName: "example.com",
        type: "CNAME",
        name: "www.example.com",
        content: "old.example.com",
        ttl: 300,
        tags: [],
      }],
    );
    expect(preview.parsed).toBe(3);
    expect(preview.conflicts).toEqual(["CNAME www.example.com"]);
  });
});
