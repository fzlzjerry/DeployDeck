import type { DnsRecord, DnsRecordType } from "@shared/models";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { InspectorHeader, InspectorPanel, ScreenToolbar } from "@/components/ui/layout";
import {
  Badge,
  Button,
  CheckboxControl,
  Input,
  Label,
  SelectControl,
  Skeleton,
  Tooltip,
} from "@/components/ui/primitives";
import { useConnection } from "@/hooks/use-connection";
import { useZones } from "@/hooks/use-data";
import { cn } from "@/lib/cn";
import { copyText, errorMessage, formatWhen } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";

const TYPES: DnsRecordType[] = ["A", "AAAA", "CNAME", "TXT", "MX", "CAA", "SRV", "NS"];

const TYPE_OPTIONS = TYPES.map((value) => ({ value, label: value }));
const TYPE_FILTER_OPTIONS = [{ value: "all", label: "All types" }, ...TYPE_OPTIONS];
const PROXY_FILTER_OPTIONS = [
  { value: "all", label: "Any proxy mode" },
  { value: "yes", label: "Proxied" },
  { value: "no", label: "DNS only" },
];
const SORT_OPTIONS = [
  { value: "name", label: "Sort by name" },
  { value: "type", label: "Sort by type" },
  { value: "ttl", label: "Sort by TTL" },
  { value: "content", label: "Sort by content" },
];

export function DnsScreen() {
  const connection = useConnection();
  const zones = useZones();
  const [zoneId, setZoneId] = useState<string>();
  const [zoneSearch, setZoneSearch] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<DnsRecordType | "all">("all");
  const [proxied, setProxied] = useState<"all" | "yes" | "no">("all");
  const [sort, setSort] = useState<"name" | "type" | "ttl" | "content">("name");
  const [editing, setEditing] = useState<Partial<DnsRecord> | null>(null);
  const client = useQueryClient();
  const ask = useUiStore((state) => state.askConfirm);
  const selectedZone = (zones.data ?? []).find((zone) => zone.id === zoneId) ?? zones.data?.[0];

  const visibleZones = useMemo(() => {
    const query = zoneSearch.trim().toLocaleLowerCase();
    if (!query) return zones.data ?? [];
    return (zones.data ?? []).filter((zone) =>
      `${zone.name} ${zone.status} ${zone.planName ?? ""}`.toLocaleLowerCase().includes(query),
    );
  }, [zoneSearch, zones.data]);

  const records = useQuery({
    queryKey: ["dns-records", selectedZone?.id, search, type, proxied],
    enabled: Boolean(selectedZone),
    queryFn: () =>
      window.deployDeck.cloudflare.listDnsRecords(selectedZone!.id, {
        search,
        type,
        proxied: proxied === "all" ? undefined : proxied === "yes",
      }),
  });

  const items = useMemo(() => {
    const rows = [...(records.data?.items ?? [])];
    rows.sort((a, b) => {
      if (sort === "ttl") return a.ttl - b.ttl;
      return String(a[sort]).localeCompare(String(b[sort]), undefined, { sensitivity: "base" });
    });
    return rows;
  }, [records.data, sort]);

  const selectZone = (nextZoneId: string) => {
    setZoneId(nextZoneId);
    setEditing(null);
  };

  const resetRecordFilters = () => {
    setSearch("");
    setType("all");
    setProxied("all");
    setSort("name");
  };

  const requestDelete = (record: DnsRecord) => {
    ask({
      title: "Delete DNS record",
      body: `${record.type} ${record.name} will be permanently removed from ${record.zoneName || selectedZone?.name || "this zone"}.`,
      actionLabel: "Delete record",
      intent: "danger",
      onConfirm: async () => {
        await window.deployDeck.cloudflare.deleteDnsRecord(record.zoneId, record.id);
        if (editing?.id === record.id) setEditing(null);
        await client.invalidateQueries({ queryKey: ["dns-records"] });
        toast.success("DNS record deleted");
      },
    });
  };

  if (!connection.data?.cloudflare.connected) {
    return (
      <EmptyState
        title="Connect Cloudflare"
        body="DNS records require a Cloudflare token with Zone and DNS permissions."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-surface/45" aria-label="DNS zones">
        <div className="border-b border-line p-2">
          <Input
            value={zoneSearch}
            onChange={(event) => setZoneSearch(event.target.value)}
            placeholder="Search zones"
            aria-label="Search DNS zones"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {zones.isLoading ? (
            <div className="space-y-2" aria-label="Loading DNS zones">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : zones.isError ? (
            <div className="px-2 py-4 text-[12px] text-failed">{errorMessage(zones.error)}</div>
          ) : visibleZones.length === 0 ? (
            <p className="px-2 py-4 text-[12px] leading-5 text-muted">
              {zoneSearch ? "No zones match this search." : "No zones are available for this account."}
            </p>
          ) : (
            visibleZones.map((zone) => {
              const active = selectedZone?.id === zone.id;
              return (
                <button
                  key={zone.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "mb-1 w-full rounded-md px-2 py-2 text-left text-[12px] outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ember/55",
                    active
                      ? "bg-bg shadow-[inset_0_0_0_1px_var(--line)]"
                      : "text-muted hover:bg-bg/70 hover:text-ink",
                  )}
                  onClick={() => selectZone(zone.id)}
                >
                  <p className="truncate font-medium text-ink">{zone.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {zone.status}
                    {zone.planName ? ` · ${zone.planName}` : ""}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {selectedZone ? (
          <>
            <ScreenToolbar>
              <Input
                placeholder="Search name or content"
                aria-label="Search DNS records"
                className="w-48"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <SelectControl
                value={type}
                onValueChange={(value) => setType(value as DnsRecordType | "all")}
                options={TYPE_FILTER_OPTIONS}
                ariaLabel="Filter by record type"
                className="w-28"
              />
              <SelectControl
                value={proxied}
                onValueChange={(value) => setProxied(value as "all" | "yes" | "no")}
                options={PROXY_FILTER_OPTIONS}
                ariaLabel="Filter by proxy mode"
                className="w-32"
              />
              <SelectControl
                value={sort}
                onValueChange={(value) => setSort(value as "name" | "type" | "ttl" | "content")}
                options={SORT_OPTIONS}
                ariaLabel="Sort DNS records"
                className="w-36"
              />
              <div className="ml-auto flex items-center gap-3">
                {records.isFetching && !records.isLoading ? (
                  <span className="text-[11px] text-muted">Updating…</span>
                ) : (
                  <span className="text-[11px] text-muted">
                    {items.length} {items.length === 1 ? "record" : "records"}
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={() =>
                    setEditing({
                      zoneId: selectedZone.id,
                      zoneName: selectedZone.name,
                      type: "A",
                      ttl: 1,
                      name: selectedZone.name,
                      content: "",
                    })
                  }
                >
                  Add record
                </Button>
              </div>
            </ScreenToolbar>

            {records.isError ? (
              <ScreenError message={errorMessage(records.error)} onRetry={() => void records.refetch()} />
            ) : records.isLoading ? (
              <div className="space-y-2 p-4" aria-label="Loading DNS records">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-8" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                title="No DNS records match"
                body="Adjust the record filters or create a new record in this zone."
                action={
                  search || type !== "all" || proxied !== "all"
                    ? { label: "Reset filters", onClick: resetRecordFilters }
                    : { label: "Add record", onClick: () => setEditing(createRecordDraft(selectedZone.id, selectedZone.name)) }
                }
              />
            ) : (
              <DnsRecordTable
                zoneName={selectedZone.name}
                records={items}
                editingId={editing?.id}
                onEdit={setEditing}
                onDelete={requestDelete}
              />
            )}
          </>
        ) : zones.isError ? (
          <ScreenError message={errorMessage(zones.error)} onRetry={() => void zones.refetch()} />
        ) : (
          <EmptyState
            title={zones.isLoading ? "Loading zones" : "Select a zone"}
            body={zones.isLoading ? "Fetching zones from Cloudflare." : "Choose a Cloudflare zone to manage its DNS records."}
          />
        )}
      </div>

      {editing && selectedZone ? (
        <RecordForm
          zoneName={selectedZone.name}
          record={editing}
          onClose={() => setEditing(null)}
          onDelete={editing.id ? () => requestDelete(editing as DnsRecord) : undefined}
          onSave={async (input) => {
            try {
              if (editing.id) await window.deployDeck.cloudflare.updateDnsRecord(editing.id, input);
              else await window.deployDeck.cloudflare.createDnsRecord(input);
              toast.success(editing.id ? "Record updated" : "Record created");
              setEditing(null);
              await client.invalidateQueries({ queryKey: ["dns-records"] });
            } catch (error) {
              toast.error(errorMessage(error));
            }
          }}
        />
      ) : null}
    </div>
  );
}

function createRecordDraft(zoneId: string, zoneName: string): Partial<DnsRecord> {
  return { zoneId, zoneName, type: "A", ttl: 1, name: zoneName, content: "" };
}

function DnsRecordTable({
  zoneName,
  records,
  editingId,
  onEdit,
  onDelete,
}: {
  zoneName: string;
  records: DnsRecord[];
  editingId?: string;
  onEdit: (record: DnsRecord) => void;
  onDelete: (record: DnsRecord) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="data-table table-fixed min-w-[800px]" aria-label={`DNS records for ${zoneName}`}>
        <colgroup>
          <col className="w-14" />
          <col className="w-36" />
          <col className="w-52" />
          <col className="w-[72px]" />
          <col className="w-12" />
          <col className="w-16" />
          <col className="w-28" />
          <col className="w-28" />
        </colgroup>
        <thead>
          <tr>
            <th>Type</th>
            <th>Name</th>
            <th>Content</th>
            <th>Proxy</th>
            <th>TTL</th>
            <th>Priority</th>
            <th>Modified</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className={cn(editingId === record.id && "bg-ember-soft/55")}>
              <td>
                <Badge variant="outline" className="font-mono text-ink">
                  {record.type}
                </Badge>
              </td>
              <td className="max-w-56 truncate font-medium">{record.name}</td>
              <td className="max-w-72 truncate font-mono text-[11px] text-muted">{record.content}</td>
              <td>{record.proxied ? "Proxied" : record.proxiable ? "DNS only" : "—"}</td>
              <td className="tabular">{record.ttl === 1 ? "Auto" : record.ttl}</td>
              <td className="tabular">{record.priority ?? "—"}</td>
              <td className="tabular">{formatWhen(record.modifiedOn, "absolute")}</td>
              <td>
                <div className="flex justify-end gap-1">
                  <CopyRecordMenu record={record} />
                  <Tooltip content="Edit record">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Edit ${record.type} record ${record.name}`}
                      onClick={() => onEdit(record)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Delete record">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-failed hover:bg-failed/10"
                      aria-label={`Delete ${record.type} record ${record.name}`}
                      onClick={() => onDelete(record)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </Tooltip>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CopyRecordMenu({ record }: { record: DnsRecord }) {
  const copy = (label: "name" | "value", value: string) => {
    void copyText(value)
      .then(() => toast.success(`Record ${label} copied`))
      .catch((error) => toast.error(errorMessage(error)));
  };

  return (
    <DropdownMenu.Root>
      <Tooltip content="Copy name or value">
        <DropdownMenu.Trigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label={`Copy name or value for ${record.name}`}
          >
            <Copy aria-hidden="true" />
          </Button>
        </DropdownMenu.Trigger>
      </Tooltip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 min-w-32 rounded-md bg-bg p-1 text-[12px] text-ink shadow-[var(--shadow-popover)]"
        >
          <DropdownMenu.Item
            className="cursor-default rounded px-2 py-1.5 outline-none data-[highlighted]:bg-surface-2"
            onSelect={() => copy("name", record.name)}
          >
            Copy name
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="cursor-default rounded px-2 py-1.5 outline-none data-[highlighted]:bg-surface-2"
            onSelect={() => copy("value", record.content)}
          >
            Copy value
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function RecordForm({
  zoneName,
  record,
  onClose,
  onSave,
  onDelete,
}: {
  zoneName: string;
  record: Partial<DnsRecord>;
  onClose: () => void;
  onSave: (input: {
    zoneId: string;
    type: DnsRecordType;
    name: string;
    content: string;
    ttl: number;
    proxied?: boolean;
    priority?: number;
    comment?: string;
    data?: Record<string, string | number | boolean | undefined>;
  }) => Promise<void>;
  onDelete?: () => void;
}) {
  const formId = useId();
  const [type, setType] = useState<DnsRecordType>(record.type ?? "A");
  const [name, setName] = useState(record.name ?? zoneName);
  const [content, setContent] = useState(record.content ?? "");
  const [ttl, setTtl] = useState(String(record.ttl ?? 1));
  const [proxied, setProxied] = useState(Boolean(record.proxied));
  const [priority, setPriority] = useState(String(record.priority ?? 10));
  const [comment, setComment] = useState(record.comment ?? "");
  const [flag, setFlag] = useState(String(record.data?.flags ?? 0));
  const [tag, setTag] = useState(String(record.data?.tag ?? "issue"));
  const [service, setService] = useState(String(record.data?.service ?? "_sip"));
  const [proto, setProto] = useState(String(record.data?.proto ?? "_tcp"));
  const [weight, setWeight] = useState(String(record.data?.weight ?? 10));
  const [port, setPort] = useState(String(record.data?.port ?? 443));
  const [saving, setSaving] = useState(false);
  const proxyable = type === "A" || type === "AAAA" || type === "CNAME";
  const valid =
    Boolean(name.trim() && content.trim()) &&
    (type !== "CAA" || Boolean(tag.trim())) &&
    (type !== "SRV" || Boolean(service.trim() && proto.trim() && port.trim()));

  const ids = {
    name: `${formId}-name`,
    content: `${formId}-content`,
    priority: `${formId}-priority`,
    flag: `${formId}-flag`,
    tag: `${formId}-tag`,
    service: `${formId}-service`,
    proto: `${formId}-proto`,
    weight: `${formId}-weight`,
    port: `${formId}-port`,
    ttl: `${formId}-ttl`,
    proxied: `${formId}-proxied`,
    comment: `${formId}-comment`,
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave({
        zoneId: record.zoneId ?? "",
        type,
        name: name.trim(),
        content: content.trim(),
        ttl: Number(ttl) || 1,
        proxied: proxyable ? proxied : undefined,
        priority: type === "MX" || type === "SRV" ? Number(priority) : undefined,
        comment: comment.trim() || undefined,
        data:
          type === "CAA"
            ? { flags: Number(flag), tag: tag.trim(), value: content.trim() }
            : type === "SRV"
              ? {
                  service: service.trim(),
                  proto: proto.trim(),
                  priority: Number(priority),
                  weight: Number(weight),
                  port: Number(port),
                  target: content.trim(),
                }
              : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <InspectorPanel size="sm" className="overflow-hidden">
      <InspectorHeader
        title={record.id ? "Edit DNS record" : "Create DNS record"}
        subtitle={`${zoneName} · ${type}`}
        onClose={onClose}
        closeLabel="Close DNS record editor"
      />
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submit(event)}>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
          <FormField label="Record type">
            <SelectControl
              value={type}
              onValueChange={(value) => setType(value as DnsRecordType)}
              options={TYPE_OPTIONS}
              ariaLabel="DNS record type"
              className="w-full"
            />
          </FormField>

          <FormField label="Name" htmlFor={ids.name}>
            <Input
              id={ids.name}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={zoneName}
              required
            />
          </FormField>

          {type !== "SRV" ? (
            <FormField label={type === "CAA" ? "Value" : "Content"} htmlFor={ids.content}>
              <Input
                id={ids.content}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={contentPlaceholder(type)}
                required
              />
            </FormField>
          ) : null}

          {type === "MX" || type === "SRV" ? (
            <FormField label="Priority" htmlFor={ids.priority}>
              <Input
                id={ids.priority}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                required
              />
            </FormField>
          ) : null}

          {type === "CAA" ? (
            <>
              <FormField label="Flags" htmlFor={ids.flag}>
                <Input
                  id={ids.flag}
                  type="number"
                  min={0}
                  max={255}
                  step={1}
                  inputMode="numeric"
                  value={flag}
                  onChange={(event) => setFlag(event.target.value)}
                />
              </FormField>
              <FormField label="Tag" htmlFor={ids.tag}>
                <Input id={ids.tag} value={tag} onChange={(event) => setTag(event.target.value)} required />
              </FormField>
            </>
          ) : null}

          {type === "SRV" ? (
            <>
              <FormField label="Service" htmlFor={ids.service}>
                <Input
                  id={ids.service}
                  value={service}
                  onChange={(event) => setService(event.target.value)}
                  placeholder="_sip"
                  required
                />
              </FormField>
              <FormField label="Protocol" htmlFor={ids.proto}>
                <Input
                  id={ids.proto}
                  value={proto}
                  onChange={(event) => setProto(event.target.value)}
                  placeholder="_tcp"
                  required
                />
              </FormField>
              <FormField label="Weight" htmlFor={ids.weight}>
                <Input
                  id={ids.weight}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  required
                />
              </FormField>
              <FormField label="Port" htmlFor={ids.port}>
                <Input
                  id={ids.port}
                  type="number"
                  min={1}
                  max={65535}
                  step={1}
                  inputMode="numeric"
                  value={port}
                  onChange={(event) => setPort(event.target.value)}
                  required
                />
              </FormField>
              <FormField label="Target" htmlFor={ids.content}>
                <Input
                  id={ids.content}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="target.example.com"
                  required
                />
              </FormField>
            </>
          ) : null}

          <FormField label="TTL" htmlFor={ids.ttl} hint="Use 1 for Cloudflare automatic TTL.">
            <Input
              id={ids.ttl}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={ttl}
              onChange={(event) => setTtl(event.target.value)}
              required
            />
          </FormField>

          {proxyable ? (
            <div className="rounded-md bg-surface px-2.5 py-2.5">
              <div className="flex items-center gap-2">
                <CheckboxControl
                  id={ids.proxied}
                  checked={proxied}
                  onCheckedChange={setProxied}
                  ariaLabel="Proxy this record through Cloudflare"
                />
                <Label htmlFor={ids.proxied} className="text-[12px] text-ink">
                  Cloudflare proxy
                </Label>
              </div>
              <p className="mt-1 pl-6 text-[11px] leading-4 text-muted">
                Route traffic through Cloudflare instead of exposing the origin directly.
              </p>
            </div>
          ) : null}

          <FormField label="Comment" htmlFor={ids.comment} hint="Optional. Stored with the record in Cloudflare.">
            <Input
              id={ids.comment}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Why this record exists"
            />
          </FormField>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line p-3">
          <div>
            {onDelete ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-failed hover:bg-failed/10"
                disabled={saving}
                onClick={onDelete}
              >
                Delete record
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving} disabled={!valid}>
              {record.id ? "Save changes" : "Create record"}
            </Button>
          </div>
        </div>
      </form>
    </InspectorPanel>
  );
}

function FormField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor} className="text-ink">
          {label}
        </Label>
        {hint ? <span className="text-right text-[10px] leading-4 text-muted">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function contentPlaceholder(type: DnsRecordType): string {
  switch (type) {
    case "A":
      return "192.0.2.1";
    case "AAAA":
      return "2001:db8::1";
    case "CNAME":
    case "MX":
    case "NS":
      return "target.example.com";
    case "TXT":
      return "Text value";
    case "CAA":
      return "letsencrypt.org";
    case "SRV":
      return "target.example.com";
  }
}
