import type { UnifiedDomain } from "@shared/models";
import { domainNeedsDns, matchDnsZone } from "@shared/domain-dns";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button } from "@/components/ui/primitives";
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
    <div className="space-y-2">
      <p className="text-label font-medium text-muted">
        {records.length === 1 ? "Required DNS record" : `Required DNS records (${records.length})`}
      </p>
      <div className="divide-y divide-line/70 overflow-hidden rounded-control border border-line bg-panel">
        {records.map((record) => (
          <div
            key={`${record.type}:${record.name}:${record.value}`}
            className="flex items-center justify-between gap-3 px-3 py-1.5"
          >
            <p className="flex min-w-0 items-center gap-2 font-mono text-label select-text">
              <Badge variant="outline" className="shrink-0 font-mono text-ink">
                {record.type}
              </Badge>
              <span className="truncate text-ink">{record.name}</span>
              <span className="shrink-0 text-subtle">→</span>
              <span className="truncate text-muted">{record.value}</span>
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
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button size="sm" variant="secondary" loading={writing} disabled={!canWrite} onClick={() => void write()}>
          Write DNS
        </Button>
        <span className="text-dense text-muted">
          {canWrite
            ? `Writes into ${zone?.name} as DNS only.`
            : "Connect Cloudflare with a matching zone to write these records."}
        </span>
      </div>
    </div>
  );
}
