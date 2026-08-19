import type { DnsRecordType, DnsZone, DomainVerificationRecord, UnifiedDomain } from "./models";

const RECORD_TYPES = new Set<DnsRecordType>(["A", "AAAA", "CNAME", "TXT", "MX", "CAA", "SRV", "NS"]);

export function asDnsRecordType(value: string | undefined): DnsRecordType | undefined {
  if (!value) return undefined;
  const type = value.toUpperCase() as DnsRecordType;
  return RECORD_TYPES.has(type) ? type : undefined;
}

export function matchDnsZone<T extends Pick<DnsZone, "name">>(hostname: string, zones: T[]): T | undefined {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  return zones
    .filter((zone) => {
      const name = zone.name.replace(/\.$/, "").toLowerCase();
      return host === name || host.endsWith(`.${name}`);
    })
    .sort((a, b) => b.name.length - a.name.length)[0];
}

export function vercelVerificationRecords(
  verification: Array<{ type?: string; domain?: string; value?: string; reason?: string }> | undefined,
  domainName: string,
  apex?: boolean,
): DomainVerificationRecord[] {
  const records: DomainVerificationRecord[] = [];
  for (const item of verification ?? []) {
    const name = String(item.domain ?? "").trim();
    const value = String(item.value ?? "").trim();
    if (!name || !value) continue;
    records.push({
      type: asDnsRecordType(item.type) ?? "TXT",
      name,
      value,
      reason: item.reason,
    });
  }

  if (!apex && !records.some((item) => item.type === "CNAME" && namesEqual(item.name, domainName))) {
    records.push({
      type: "CNAME",
      name: domainName,
      value: "cname.vercel-dns.com",
      reason: "Point this hostname at Vercel",
    });
  }
  return dedupeRecords(records);
}

export function pagesVerificationRecords(
  validation: { txt_name?: string; txt_value?: string } | undefined,
  domainName: string,
  projectName: string,
): DomainVerificationRecord[] {
  const records: DomainVerificationRecord[] = [];
  if (validation?.txt_name && validation.txt_value) {
    records.push({
      type: "TXT",
      name: validation.txt_name,
      value: validation.txt_value,
      reason: "Pages domain validation",
    });
  }
  if (domainName) {
    records.push({
      type: "CNAME",
      name: domainName,
      value: `${projectName}.pages.dev`,
      reason: "Point this hostname at Pages",
    });
  }
  return dedupeRecords(records);
}

export function namesEqual(left: string, right: string): boolean {
  return left.replace(/\.$/, "").toLowerCase() === right.replace(/\.$/, "").toLowerCase();
}

export function duplicateDnsError(message: string): boolean {
  const value = message.toLowerCase();
  return value.includes("already exists") || value.includes("identical record already exists") || value.includes("81053");
}

export function domainNeedsDns(domain: Pick<UnifiedDomain, "verified" | "verificationRecords">): boolean {
  return domain.verified !== true && (domain.verificationRecords?.length ?? 0) > 0;
}

function dedupeRecords(records: DomainVerificationRecord[]): DomainVerificationRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.type}:${record.name.toLowerCase()}:${record.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
