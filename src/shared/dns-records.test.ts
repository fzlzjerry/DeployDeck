import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLOUDFLARE_DNS_TYPES,
  DNS_TYPE_DEFINITIONS,
  VERCEL_DNS_TYPES,
  createDnsRecordDraft,
  dnsTypesForProvider,
  normalizeDnsName,
  serializeDnsRecordDraft,
  validateDnsRecordDraft,
} from "./dns-records";
import { normalizeDnsRecord } from "../main/providers/cloudflare-normalize";

describe("DNS record registry", () => {
  it("contains all current Cloudflare and Vercel record types", () => {
    assert.equal(CLOUDFLARE_DNS_TYPES.length, 21);
    assert.equal(VERCEL_DNS_TYPES.length, 10);
    assert.equal(dnsTypesForProvider("cloudflare").includes("OPENPGPKEY"), true);
    assert.equal(dnsTypesForProvider("cloudflare").includes("SVCB"), true);
    assert.equal(dnsTypesForProvider("vercel").includes("ALIAS"), true);
    assert.equal(dnsTypesForProvider("vercel").includes("TLSA"), false);
    for (const type of new Set([...CLOUDFLARE_DNS_TYPES, ...VERCEL_DNS_TYPES])) {
      assert.equal(DNS_TYPE_DEFINITIONS[type].type, type);
      assert.ok(DNS_TYPE_DEFINITIONS[type].fields.length > 0);
    }
  });

  it("normalizes apex, relative, FQDN, and trailing-dot names", () => {
    assert.equal(normalizeDnsName("@", "example.com"), "example.com");
    assert.equal(normalizeDnsName("www", "example.com"), "www.example.com");
    assert.equal(normalizeDnsName("WWW.EXAMPLE.COM.", "example.com"), "www.example.com");
  });

  it("preserves unknown provider types instead of relabelling them as TXT", () => {
    const record = normalizeDnsRecord(
      { id: "future", type: "FUTURETYPE", name: "x.example.com", content: "raw", ttl: 60 },
      { id: "zone", name: "example.com" },
    );
    assert.equal(record.type, "UNKNOWN");
    assert.equal(record.rawType, "FUTURETYPE");
    assert.equal(record.content, "raw");
  });

  it("validates address and TTL boundaries", () => {
    const a = createDnsRecordDraft("A", "example.com");
    a.values.content = "999.1.1.1";
    a.ttl = 20;
    assert.equal(validateDnsRecordDraft(a, "example.com").content, "Enter a valid IPv4 address.");
    assert.match(validateDnsRecordDraft(a, "example.com").ttl, /between 60 and 86400/);
    a.values.content = "192.0.2.1";
    a.ttl = 1;
    assert.deepEqual(validateDnsRecordDraft(a, "example.com"), {});
  });

  it("serializes SRV service labels into the name and sends only provider data", () => {
    const draft = createDnsRecordDraft("SRV", "example.com");
    draft.name = "chat";
    draft.values.service = "xmpp";
    draft.values.protocol = "tcp";
    draft.values.priority = 10;
    draft.values.weight = 5;
    draft.values.port = 5223;
    draft.values.target = "server.example.com";
    const input = serializeDnsRecordDraft(draft, "cloudflare", "zone", "example.com");
    assert.equal(input.name, "_xmpp._tcp.chat.example.com");
    assert.deepEqual(input.data, { priority: 10, weight: 5, port: 5223, target: "server.example.com" });
    assert.equal("service" in (input.data ?? {}), false);
    assert.equal("protocol" in (input.data ?? {}), false);
  });

  it("builds a serializable payload for every supported Cloudflare type", () => {
    for (const type of CLOUDFLARE_DNS_TYPES) {
      const draft = createDnsRecordDraft(type, "example.com");
      for (const field of DNS_TYPE_DEFINITIONS[type].fields) {
        if (draft.values[field.key] !== undefined) continue;
        if (field.input === "number") draft.values[field.key] = Math.max(field.min ?? 0, 1);
        else if (field.input === "select") draft.values[field.key] = field.options?.[0]?.value ?? "value";
        else draft.values[field.key] = field.placeholder?.replace(/^Base64 .*/, "ZmFrZQ==") ?? "value";
      }
      if (type === "A") draft.values.content = "192.0.2.1";
      if (type === "AAAA") draft.values.content = "2001:db8::1";
      const errors = validateDnsRecordDraft(draft, "example.com");
      assert.deepEqual(errors, {}, `${type} should have a valid populated fixture`);
      const input = serializeDnsRecordDraft(draft, "cloudflare", "zone", "example.com");
      assert.equal(input.type, type);
      assert.ok(input.name.endsWith("example.com"));
    }
  });

  it("validates and serializes every Vercel-supported type without leaking Cloudflare options", () => {
    for (const type of VERCEL_DNS_TYPES) {
      const draft = createDnsRecordDraft(type, "example.com");
      for (const field of DNS_TYPE_DEFINITIONS[type].fields) {
        if (draft.values[field.key] !== undefined) continue;
        if (field.input === "number") draft.values[field.key] = Math.max(field.min ?? 0, 1);
        else if (field.input === "select") draft.values[field.key] = field.options?.[0]?.value ?? "value";
        else draft.values[field.key] = field.placeholder ?? "value";
      }
      if (type === "A") draft.values.content = "192.0.2.1";
      if (type === "AAAA") draft.values.content = "2001:db8::1";
      assert.deepEqual(validateDnsRecordDraft(draft, "example.com"), {}, `${type} should validate`);
      const input = serializeDnsRecordDraft(draft, "vercel", "example.com", "example.com");
      assert.equal(input.provider, "vercel");
      assert.equal(input.type, type);
      assert.equal(input.proxied, type === "A" || type === "AAAA" || type === "CNAME" ? false : undefined);
    }
  });
});
