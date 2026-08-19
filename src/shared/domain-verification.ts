import type { DomainVerificationRecord } from "./models";

interface LooseRecord {
  [key: string]: unknown;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function vercelVerificationRecords(verification: unknown): DomainVerificationRecord[] {
  if (!Array.isArray(verification)) return [];
  const records: DomainVerificationRecord[] = [];
  for (const item of verification as LooseRecord[]) {
    const type = text(item.type) ?? text(item.reason) ?? "TXT";
    const name = text(item.domain) ?? text(item.name) ?? "";
    const value = text(item.value) ?? text(item.reason) ?? "";
    if (!name && !value) continue;
    records.push({ type, name, value, reason: text(item.reason) });
  }
  return records;
}

export function pagesVerificationRecords(
  domain: LooseRecord,
  projectName: string,
): DomainVerificationRecord[] {
  const validation = (domain.validation_data ?? {}) as LooseRecord;
  const records: DomainVerificationRecord[] = [];
  const txtName = text(validation.txt_name) ?? text(validation.txtName);
  const txtValue = text(validation.txt_value) ?? text(validation.txtValue);
  if (txtName || txtValue) {
    records.push({
      type: "TXT",
      name: txtName ?? String(domain.name ?? ""),
      value: txtValue ?? "",
      reason: text(validation.status),
    });
  }
  const cnameName = text(validation.cname) ?? text(validation.cname_name);
  const cnameTarget = text(validation.cname_target) ?? text(validation.cnameTarget);
  if (cnameName || cnameTarget) {
    records.push({
      type: "CNAME",
      name: cnameName ?? String(domain.name ?? ""),
      value: cnameTarget ?? `${projectName}.pages.dev`,
      reason: text(validation.method),
    });
  }
  if (records.length === 0 && text(domain.status) !== "active") {
    records.push({
      type: "CNAME",
      name: String(domain.name ?? ""),
      value: `${projectName}.pages.dev`,
      reason: "Point this hostname at the Pages project while it is pending.",
    });
  }
  return records;
}
