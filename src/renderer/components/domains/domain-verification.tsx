import type { UnifiedDomain } from "@shared/models";
import { domainNeedsDns, matchDnsZone } from "@shared/domain-dns";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { useZones } from "@/hooks/use-data";
import { copyText, errorMessage } from "@/lib/format";
import { summarizeWriteResult, writeDomainVerification } from "@/lib/write-domain-dns";

export function DomainVerification({
  domain,
  onWritten,
}: {
  domain: UnifiedDomain;
  onWritten?: () => void;
}) {
  const zones = useZones();
  const [writing, setWriting] = useState(false);
  const records = domain.verificationRecords ?? [];
  if (!domainNeedsDns(domain) || records.length === 0) return null;

  const zone = matchDnsZone(domain.name, zones.data ?? []);
  const canWrite = Boolean(zones.data && zone);

  const write = async () => {
    setWriting(true);
    try {
      const result = await writeDomainVerification(domain, zones.data ?? []);
      toast.success(summarizeWriteResult(result));
      onWritten?.();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setWriting(false);
    }
  };

  return (
    <div className="mt-2 space-y-1.5">
      {records.map((record) => (
        <div key={`${record.type}:${record.name}:${record.value}`} className="flex items-start justify-between gap-2">
          <p className="min-w-0 font-mono text-[11px] leading-4 text-muted">
            <span className="text-ink">{record.type}</span> {record.name} → {record.value}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => void copyText(`${record.type} ${record.name} ${record.value}`)}
          >
            Copy
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" variant="secondary" loading={writing} disabled={!canWrite} onClick={() => void write()}>
          Write DNS
        </Button>
        <span className="text-[11px] text-muted">
          {canWrite
            ? `Writes into ${zone?.name} as DNS only.`
            : "Connect Cloudflare with a matching zone to write these records."}
        </span>
      </div>
    </div>
  );
}
