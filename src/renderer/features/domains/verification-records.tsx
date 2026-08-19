import type { DomainVerificationRecord } from "@shared/models";
import { Button } from "@/components/ui/primitives";
import { copyText, errorMessage } from "@/lib/format";
import { toast } from "sonner";

export function VerificationRecords({
  records,
  compact = false,
}: {
  records: DomainVerificationRecord[];
  compact?: boolean;
}) {
  if (records.length === 0) return null;

  const copy = async (label: string, value: string) => {
    try {
      await copyText(value);
      toast.success(`${label} copied`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className={compact ? "mt-1 space-y-1" : "space-y-2"}>
      {records.map((record, index) => (
        <div
          key={`${record.type}:${record.name}:${record.value}:${index}`}
          className="rounded-md bg-surface px-2.5 py-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-ink">
                <span className="text-muted">{record.type}</span> {record.name || "—"}
              </p>
              <p className="mt-0.5 break-all font-mono text-[11px] text-muted select-text">{record.value || "—"}</p>
              {record.reason ? <p className="mt-0.5 text-[10px] text-subtle">{record.reason}</p> : null}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              {record.name ? (
                <Button size="sm" variant="ghost" onClick={() => void copy("Name", record.name)}>
                  Copy name
                </Button>
              ) : null}
              {record.value ? (
                <Button size="sm" variant="ghost" onClick={() => void copy("Value", record.value)}>
                  Copy value
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
