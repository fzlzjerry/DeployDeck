import type { DnsZone, UnifiedDomain } from "@shared/models";
import { isSupportedDnsRecordType } from "@shared/dns-records";
import { domainNeedsDns, duplicateDnsError, matchDnsZone } from "@shared/domain-dns";
import { errorMessage } from "@/lib/format";

export async function writeDomainVerification(
  domain: UnifiedDomain,
  zones: DnsZone[],
): Promise<{ zoneName: string; written: number; skipped: number }> {
  const records = domain.verificationRecords ?? [];
  if (!domainNeedsDns(domain) || records.length === 0) {
    throw new Error("This domain has no verification records to write.");
  }
  const cloudflareZones = zones.filter((item) => item.provider === "cloudflare");
  const zone =
    matchDnsZone(domain.name, cloudflareZones) ??
    records.map((record) => matchDnsZone(record.name, cloudflareZones)).find(Boolean);
  if (!zone) {
    throw new Error("No matching Cloudflare zone is connected for this hostname.");
  }

  let written = 0;
  let skipped = 0;
  const failures: string[] = [];
  for (const record of records) {
    if (!isSupportedDnsRecordType(record.type)) {
      failures.push(`${record.type} ${record.name}: unsupported verification record type`);
      continue;
    }
    try {
      await window.deployDeck.cloudflare.createDnsRecord({
        provider: "cloudflare",
        zoneId: zone.id,
        type: record.type,
        name: record.name,
        content: record.value,
        ttl: 1,
        proxied: false,
        comment: record.reason,
      });
      written += 1;
    } catch (error) {
      if (duplicateDnsError(errorMessage(error))) skipped += 1;
      else failures.push(`${record.type} ${record.name}: ${errorMessage(error)}`);
    }
  }
  if (written === 0 && skipped === 0 && failures.length > 0) {
    throw new Error(failures[0]);
  }
  return { zoneName: zone.name, written, skipped };
}

export function summarizeWriteResult(result: { zoneName: string; written: number; skipped: number }): string {
  const parts = [`Wrote ${result.written} record${result.written === 1 ? "" : "s"} to ${result.zoneName}`];
  if (result.skipped > 0) parts.push(`${result.skipped} already present`);
  return parts.join(". ");
}
