import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asDnsRecordType,
  duplicateDnsError,
  matchDnsZone,
  pagesVerificationRecords,
  vercelVerificationRecords,
} from "./domain-dns";

describe("matchDnsZone", () => {
  const zones = [
    { name: "example.com" },
    { name: "app.example.com" },
    { name: "other.dev" },
  ];

  it("picks the longest matching zone", () => {
    assert.equal(matchDnsZone("api.app.example.com", zones)?.name, "app.example.com");
    assert.equal(matchDnsZone("www.example.com", zones)?.name, "example.com");
    assert.equal(matchDnsZone("example.com", zones)?.name, "example.com");
  });

  it("returns undefined when no zone matches", () => {
    assert.equal(matchDnsZone("unrelated.net", zones), undefined);
  });
});

describe("verification records", () => {
  it("maps Vercel TXT challenges and adds a CNAME for subdomains", () => {
    const records = vercelVerificationRecords(
      [{ type: "TXT", domain: "_vercel.www.example.com", value: "vc-ok", reason: "ownership" }],
      "www.example.com",
      false,
    );
    assert.equal(records.length, 2);
    assert.equal(records[0]?.type, "TXT");
    assert.equal(records[1]?.type, "CNAME");
    assert.equal(records[1]?.value, "cname.vercel-dns.com");
  });

  it("does not invent a CNAME for apex Vercel domains", () => {
    const records = vercelVerificationRecords([], "example.com", true);
    assert.equal(records.length, 0);
  });

  it("maps Pages TXT validation and a CNAME to the project", () => {
    const records = pagesVerificationRecords(
      { txt_name: "_cf.example.com", txt_value: "token" },
      "www.example.com",
      "docs",
    );
    assert.deepEqual(
      records.map((item) => item.type),
      ["TXT", "CNAME"],
    );
    assert.equal(records[1]?.value, "docs.pages.dev");
  });
});

describe("dns helpers", () => {
  it("accepts known record types only", () => {
    assert.equal(asDnsRecordType("txt"), "TXT");
    assert.equal(asDnsRecordType("HTTPS"), undefined);
  });

  it("detects duplicate-record provider errors", () => {
    assert.equal(duplicateDnsError("An identical record already exists."), true);
    assert.equal(duplicateDnsError("Record 81053 conflict"), true);
    assert.equal(duplicateDnsError("permission denied"), false);
  });
});
