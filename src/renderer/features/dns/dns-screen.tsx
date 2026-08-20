import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, Download, FileUp, MoreHorizontal, Pencil, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import type { DnsProvider, DnsRecord, DnsZone, SupportedDnsRecordType } from "@shared/models";
import {
  DNS_TYPE_DEFINITIONS,
  DNS_TYPE_GROUPS,
  createDnsRecordDraft,
  dnsDraftFromRecord,
  dnsTypesForProvider,
  normalizeDnsName,
  serializeDnsRecordDraft,
  validateDnsRecordDraft,
  type DnsFieldDefinition,
  type DnsRecordDraft,
} from "@shared/dns-records";
import { EmptyState, ScreenError } from "@/components/common/empty-state";
import { ProviderGlyph } from "@/components/common/provider-glyph";
import { InspectorHeader, InspectorPanel, ResourceListFrame, ScreenToolbar } from "@/components/ui/layout";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/menu";
import { Panel } from "@/components/ui/panel";
import {
  Badge,
  Button,
  CheckboxControl,
  Input,
  Label,
  SelectControl,
  Skeleton,
  TableSkeleton,
  Textarea,
} from "@/components/ui/primitives";
import { useConnection } from "@/hooks/use-connection";
import { useDnsZones } from "@/hooks/use-data";
import { cn } from "@/lib/cn";
import { copyText, errorMessage, formatWhen } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";

type TypeFilter = SupportedDnsRecordType | "all";
type ProxyFilter = "all" | "yes" | "no";
type SortKey = "name" | "type" | "ttl" | "content";

const PROVIDER_OPTIONS = [
  { value: "all", label: "All providers" },
  { value: "cloudflare", label: "Cloudflare" },
  { value: "vercel", label: "Vercel" },
] as const;

const PROXY_FILTER_OPTIONS = [
  { value: "all", label: "Any proxy mode" },
  { value: "yes", label: "Proxied" },
  { value: "no", label: "DNS only" },
] as const;

const SORT_OPTIONS = [
  { value: "name", label: "Sort by name" },
  { value: "type", label: "Sort by type" },
  { value: "ttl", label: "Sort by TTL" },
  { value: "content", label: "Sort by content" },
] as const;

const TTL_OPTIONS = [
  { value: "1", label: "Auto" },
  { value: "60", label: "1 minute" },
  { value: "300", label: "5 minutes" },
  { value: "1800", label: "30 minutes" },
  { value: "3600", label: "1 hour" },
  { value: "14400", label: "4 hours" },
  { value: "86400", label: "1 day" },
] as const;

interface EditingState {
  record?: DnsRecord;
  draft?: DnsRecordDraft;
  returnFocusTo?: HTMLElement | null;
}

export function DnsScreen() {
  const connection = useConnection();
  const zones = useDnsZones();
  const client = useQueryClient();
  const ask = useUiStore((state) => state.askConfirm);
  const zoneFocus = useUiStore((state) => state.zoneFocus);
  const createIntent = useUiStore((state) => state.createResource);
  const closeCreate = useUiStore((state) => state.closeCreate);
  const [selectedZoneKey, setSelectedZoneKey] = useState<string>();
  const [provider, setProvider] = useState<"all" | DnsProvider>("all");
  const [zoneSearch, setZoneSearch] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [proxied, setProxied] = useState<ProxyFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTtl, setBulkTtl] = useState("300");

  const visibleZones = useMemo(() => {
    const query = zoneSearch.trim().toLowerCase();
    return (zones.data ?? []).filter((zone) => {
      if (provider !== "all" && zone.provider !== provider) return false;
      return !query || `${zone.name} ${zone.accountName} ${zone.status}`.toLowerCase().includes(query);
    });
  }, [provider, zoneSearch, zones.data]);

  const selectedZone =
    (zones.data ?? []).find((zone) => zoneKey(zone) === selectedZoneKey) ??
    (zones.data ?? []).find((zone) => zone.id === zoneFocus) ??
    visibleZones[0];

  useEffect(() => {
    if (selectedZone && selectedZoneKey !== zoneKey(selectedZone)) setSelectedZoneKey(zoneKey(selectedZone));
  }, [selectedZone, selectedZoneKey]);

  useEffect(() => {
    if (type !== "all" && selectedZone && !dnsTypesForProvider(selectedZone.provider).includes(type)) setType("all");
    setSelectedIds(new Set());
    setEditing(null);
  }, [selectedZone, type]);

  const records = useInfiniteQuery({
    queryKey: ["dns-records", selectedZone?.provider, selectedZone?.id, search, type, proxied],
    enabled: Boolean(selectedZone),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      if (!selectedZone) throw new Error("Select a DNS zone.");
      if (selectedZone.provider === "vercel") {
        return window.deployDeck.vercel.listDnsRecords(selectedZone.id, { search, type, page: pageParam });
      }
      return window.deployDeck.cloudflare.listDnsRecords(selectedZone.id, {
        search,
        type,
        proxied: proxied === "all" ? undefined : proxied === "yes",
        page: pageParam,
      });
    },
    getNextPageParam: (last) => (last.nextCursor ? Number(last.nextCursor) : undefined),
  });

  const items = useMemo(() => {
    const next = [...(records.data?.pages.flatMap((page) => page.items) ?? [])];
    next.sort((left, right) => {
      if (sort === "ttl") return left.ttl - right.ttl;
      const leftValue = sort === "type" ? displayType(left) : String(left[sort] ?? "");
      const rightValue = sort === "type" ? displayType(right) : String(right[sort] ?? "");
      return leftValue.localeCompare(rightValue, undefined, { sensitivity: "base" });
    });
    return next;
  }, [records.data, sort]);

  const canWrite = selectedZone?.provider === "vercel" || Boolean(connection.data?.cloudflare.capabilities?.dnsWrite);
  const secondaryFilterCount = Number(type !== "all") + Number(proxied !== "all") + Number(sort !== "name");
  const selectedRecords = items.filter((record) => selectedIds.has(record.id));
  const selectableRecords = items.filter((record) => record.type !== "UNKNOWN");
  const allSelected = selectableRecords.length > 0 && selectableRecords.every((record) => selectedIds.has(record.id));

  const openCreate = useCallback(() => {
    if (!selectedZone) return;
    const firstType = dnsTypesForProvider(selectedZone.provider)[0] ?? "A";
    setEditing({ draft: createDnsRecordDraft(firstType, selectedZone.name) });
  }, [selectedZone]);

  useEffect(() => {
    if (createIntent === "dns-record" && selectedZone) {
      openCreate();
      closeCreate();
    }
  }, [closeCreate, createIntent, openCreate, selectedZone]);

  const deleteRecord = (record: DnsRecord) =>
    record.provider === "cloudflare"
      ? window.deployDeck.cloudflare.deleteDnsRecord(record.zoneId, record.id)
      : window.deployDeck.vercel.deleteDnsRecord(record.zoneId, record.id);

  const requestDelete = (record: DnsRecord) => {
    ask({
      title: "Delete DNS record",
      body: `${displayType(record)} ${record.name} will be permanently removed from ${record.zoneName}.`,
      actionLabel: "Delete record",
      intent: "danger",
      onConfirm: async () => {
        await deleteRecord(record);
        setEditing((current) => (current?.record?.id === record.id ? null : current));
        setSelectedIds((current) => without(current, record.id));
        await client.invalidateQueries({ queryKey: ["dns-records"] });
        toast.success("DNS record deleted");
      },
    });
  };

  const applyBulkTtl = async () => {
    if (!selectedZone || selectedRecords.length === 0) return;
    const ttl = Number(bulkTtl);
    try {
      if (selectedZone.provider === "cloudflare") {
        await window.deployDeck.cloudflare.batchDnsRecords({
          provider: "cloudflare",
          zoneId: selectedZone.id,
          patches: selectedRecords.flatMap((record) => {
            const draft = dnsDraftFromRecord(record);
            if (!draft) return [];
            draft.ttl = ttl;
            return [{ id: record.id, input: serializeDnsRecordDraft(draft, "cloudflare", selectedZone.id, selectedZone.name) }];
          }),
        });
      } else {
        for (const record of selectedRecords) {
          const draft = dnsDraftFromRecord(record);
          if (!draft) continue;
          draft.ttl = ttl;
          await window.deployDeck.vercel.updateDnsRecord(record.id, serializeDnsRecordDraft(draft, "vercel", selectedZone.id, selectedZone.name));
        }
      }
      await client.invalidateQueries({ queryKey: ["dns-records"] });
      toast.success(`Updated ${selectedRecords.length} record${selectedRecords.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const requestBulkDelete = () => {
    if (!selectedZone || selectedRecords.length === 0) return;
    ask({
      title: "Delete selected DNS records",
      body: `${selectedRecords.length} record${selectedRecords.length === 1 ? "" : "s"} will be permanently removed from ${selectedZone.name}.`,
      actionLabel: "Delete records",
      intent: "danger",
      onConfirm: async () => {
        if (selectedZone.provider === "cloudflare") {
          await window.deployDeck.cloudflare.batchDnsRecords({ provider: "cloudflare", zoneId: selectedZone.id, deletes: selectedRecords.map((record) => record.id) });
        } else {
          for (const record of selectedRecords) await window.deployDeck.vercel.deleteDnsRecord(record.zoneId, record.id);
        }
        setSelectedIds(new Set());
        await client.invalidateQueries({ queryKey: ["dns-records"] });
        toast.success("Selected DNS records deleted");
      },
    });
  };

  const applyBulkProxy = async (nextProxied: boolean) => {
    if (!selectedZone || selectedZone.provider !== "cloudflare") return;
    const patches = selectedRecords.flatMap((record) => {
      if (record.type === "UNKNOWN" || !DNS_TYPE_DEFINITIONS[record.type].proxyable) return [];
      const draft = dnsDraftFromRecord(record);
      if (!draft) return [];
      draft.proxied = nextProxied;
      return [{ id: record.id, input: serializeDnsRecordDraft(draft, "cloudflare", selectedZone.id, selectedZone.name) }];
    });
    if (patches.length === 0) {
      toast.error("The selected records cannot be proxied.");
      return;
    }
    try {
      await window.deployDeck.cloudflare.batchDnsRecords({ provider: "cloudflare", zoneId: selectedZone.id, patches });
      await client.invalidateQueries({ queryKey: ["dns-records"] });
      toast.success(nextProxied ? "Cloudflare proxy enabled" : "Records changed to DNS only");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const importZone = async () => {
    if (!selectedZone || selectedZone.provider !== "cloudflare" || !canWrite) return;
    const file = await window.deployDeck.files.openText({ extensions: ["txt", "zone", "bind"], title: "Import BIND zone file" });
    if (!file) return;
    const preview = previewBindZone(file.contents, selectedZone.name, items);
    ask({
      title: "Import BIND zone",
      body: `${preview.parsed} recognizable record${preview.parsed === 1 ? "" : "s"}; ${preview.conflicts.length} potential conflict${preview.conflicts.length === 1 ? "" : "s"}${preview.conflicts.length ? ` (${preview.conflicts.slice(0, 4).join(", ")}${preview.conflicts.length > 4 ? "…" : ""})` : ""}. Cloudflare will return the authoritative import summary.`,
      actionLabel: "Import records",
      intent: preview.conflicts.length ? "warning" : "default",
      onConfirm: async () => {
        try {
          const result = await window.deployDeck.cloudflare.importDnsRecords(selectedZone.id, file.contents);
          await client.invalidateQueries({ queryKey: ["dns-records"] });
          toast.success(`Imported ${result.added} of ${result.parsed} parsed records`);
        } catch (error) {
          toast.error(errorMessage(error));
        }
      },
    });
  };

  const exportZone = async () => {
    if (!selectedZone || selectedZone.provider !== "cloudflare") return;
    try {
      const bind = await window.deployDeck.cloudflare.exportDnsRecords(selectedZone.id);
      await window.deployDeck.files.saveText(`${selectedZone.name}.zone.txt`, bind);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (!connection.data?.cloudflare.connected && !connection.data?.vercel.connected) {
    return <EmptyState title="Connect a provider" body="Connect Cloudflare or Vercel to manage authoritative DNS zones." />;
  }

  return (
    <div className="flex h-full min-h-0">
      <ZoneRail
        zones={zones}
        visibleZones={visibleZones}
        selectedZone={selectedZone}
        provider={provider}
        zoneSearch={zoneSearch}
        onProviderChange={setProvider}
        onSearchChange={setZoneSearch}
        onSelect={(zone) => setSelectedZoneKey(zoneKey(zone))}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {selectedZone ? (
          <>
            <ResourceListFrame>
            <Panel className="min-h-0 flex-1">
            <ScreenToolbar className="dns-toolbar">
              <SelectControl
                value={zoneKey(selectedZone)}
                onValueChange={setSelectedZoneKey}
                options={visibleZones.map((zone) => ({ value: zoneKey(zone), label: zone.name }))}
                ariaLabel="Select DNS zone"
                className="hidden w-52 max-[1399px]:flex"
              />
              <div className="relative min-w-44 flex-1 basis-52">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
                <Input placeholder="Search name or content" aria-label="Search DNS records" className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div className="contents max-[1479px]:hidden"><DnsFilterControls zone={selectedZone} type={type} proxied={proxied} sort={sort} onType={setType} onProxy={setProxied} onSort={setSort} /></div>
              <Popover.Root>
                <Popover.Trigger asChild><Button size="sm" variant="outline" className="min-[1480px]:hidden"><SlidersHorizontal aria-hidden /> Filters{secondaryFilterCount ? ` · ${secondaryFilterCount}` : ""}</Button></Popover.Trigger>
                <Popover.Portal><Popover.Content align="start" sideOffset={6} collisionPadding={8} className="z-[var(--z-dropdown)] w-72 space-y-2 rounded-panel bg-panel p-3 shadow-[var(--shadow-popover)]">
                  <DnsFilterControls zone={selectedZone} type={type} proxied={proxied} sort={sort} onType={setType} onProxy={setProxied} onSort={setSort} stacked />
                  {secondaryFilterCount ? <Button size="sm" variant="ghost" className="w-full justify-start text-muted" onClick={() => { setType("all"); setProxied("all"); setSort("name"); }}>Reset filters</Button> : null}
                </Popover.Content></Popover.Portal>
              </Popover.Root>
              <div className="ml-auto flex items-center gap-2">
                <span className="whitespace-nowrap text-dense text-muted tabular">{records.isLoading ? "Loading…" : `${items.length}${records.hasNextPage ? "+" : ""} records`}</span>
                {selectedZone.provider === "cloudflare" ? <ZoneFileMenu canImport={canWrite} onImport={importZone} onExport={exportZone} /> : null}
                <Button size="sm" variant="accent" disabled={!canWrite} onClick={openCreate}>Add record</Button>
              </div>
            </ScreenToolbar>

            {selectedIds.size > 0 ? (
              <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-line bg-panel-header px-4 py-2">
                <span className="mr-1 text-dense font-medium text-ink">{selectedIds.size} selected</span>
                <SelectControl value={bulkTtl} onValueChange={setBulkTtl} options={TTL_OPTIONS} ariaLabel="Bulk TTL" size="sm" className="w-32" />
                <Button size="sm" variant="secondary" disabled={!canWrite} onClick={() => void applyBulkTtl()}>Apply TTL</Button>
                {selectedZone.provider === "cloudflare" ? (
                  <>
                    <Button size="sm" variant="secondary" disabled={!canWrite} onClick={() => void applyBulkProxy(true)}>Proxy on</Button>
                    <Button size="sm" variant="secondary" disabled={!canWrite} onClick={() => void applyBulkProxy(false)}>DNS only</Button>
                  </>
                ) : null}
                <Button size="sm" variant="ghost" disabled={!canWrite} className="ml-auto text-failed-ink hover:bg-failed-soft" onClick={requestBulkDelete}><Trash2 aria-hidden /> Delete selected</Button>
                <Button size="icon-sm" variant="ghost" aria-label="Clear DNS selection" onClick={() => setSelectedIds(new Set())}><X aria-hidden /></Button>
              </div>
            ) : null}

            {records.isError ? (
              <ScreenError message={errorMessage(records.error)} onRetry={() => void records.refetch()} />
            ) : records.isLoading ? (
              <TableSkeleton columns={9} label="Loading DNS records" />
            ) : items.length === 0 ? (
              <EmptyState
                title="No DNS records match"
                body="Adjust the filters or create a record in this zone."
                action={{
                  label: search || type !== "all" || proxied !== "all" ? "Reset filters" : "Add record",
                  onClick: search || type !== "all" || proxied !== "all"
                    ? () => { setSearch(""); setType("all"); setProxied("all"); }
                    : openCreate,
                }}
              />
            ) : (
              <DnsRecordTable
                zone={selectedZone}
                records={items}
                selectedIds={selectedIds}
                allSelected={allSelected}
                onToggleAll={() => setSelectedIds(allSelected ? new Set() : new Set(selectableRecords.map((record) => record.id)))}
                onToggle={(record) => setSelectedIds((current) => current.has(record.id) ? without(current, record.id) : withValue(current, record.id))}
                onEdit={(record, returnFocusTo) => setEditing({ record, draft: dnsDraftFromRecord(record), returnFocusTo })}
                onDelete={requestDelete}
              />
            )}

            {records.hasNextPage ? (
              <div className="border-t border-line p-2"><Button variant="ghost" size="sm" loading={records.isFetchingNextPage} onClick={() => void records.fetchNextPage()}>Load more</Button></div>
            ) : null}
            </Panel>
            </ResourceListFrame>
          </>
        ) : <EmptyState title="Select a zone" body="Choose a Cloudflare or Vercel authoritative DNS zone." />}
      </div>

      {editing && selectedZone ? (
        <DnsRecordEditor
          key={`${selectedZone.provider}:${selectedZone.id}:${editing.record?.id ?? "new"}`}
          zone={selectedZone}
          state={editing}
          canWrite={canWrite}
          onClose={() => setEditing(null)}
          onDelete={editing.record ? () => requestDelete(editing.record!) : undefined}
          onSave={async (draft) => {
            const input = serializeDnsRecordDraft(draft, selectedZone.provider, selectedZone.id, selectedZone.name);
            try {
              if (selectedZone.provider === "cloudflare") {
                if (editing.record) await window.deployDeck.cloudflare.updateDnsRecord(editing.record.id, input);
                else await window.deployDeck.cloudflare.createDnsRecord(input);
              } else if (editing.record) await window.deployDeck.vercel.updateDnsRecord(editing.record.id, input);
              else await window.deployDeck.vercel.createDnsRecord(input);
              toast.success(editing.record ? "Record updated" : "Record created");
              setEditing(null);
              await client.invalidateQueries({ queryKey: ["dns-records"] });
            } catch (error) {
              toast.error(errorMessage(error));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}

function ZoneRail({ zones, visibleZones, selectedZone, provider, zoneSearch, onProviderChange, onSearchChange, onSelect }: {
  zones: ReturnType<typeof useDnsZones>;
  visibleZones: DnsZone[];
  selectedZone?: DnsZone;
  provider: "all" | DnsProvider;
  zoneSearch: string;
  onProviderChange: (provider: "all" | DnsProvider) => void;
  onSearchChange: (value: string) => void;
  onSelect: (zone: DnsZone) => void;
}) {
  return (
    <aside className="dns-zone-rail flex w-60 shrink-0 flex-col border-r border-line bg-surface" aria-label="DNS zones">
      <div className="space-y-2 border-b border-line p-3">
        <SelectControl value={provider} onValueChange={(value) => onProviderChange(value as typeof provider)} options={PROVIDER_OPTIONS} ariaLabel="Filter DNS zones by provider" className="w-full" />
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={zoneSearch} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search zones" aria-label="Search DNS zones" className="pl-8" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {zones.isLoading ? (
          <div className="space-y-2" aria-label="Loading DNS zones">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
        ) : zones.isError ? (
          <ScreenError size="inline" message={errorMessage(zones.error)} onRetry={() => void zones.refetch()} />
        ) : visibleZones.length === 0 ? (
          <EmptyState size="inline" title={zoneSearch ? "No zones match this search." : "No authoritative DNS zones are available."} />
        ) : visibleZones.map((zone) => {
          const active = selectedZone && zoneKey(zone) === zoneKey(selectedZone);
          return (
            <button
              key={zoneKey(zone)}
              type="button"
              aria-current={active ? "page" : undefined}
              className={cn(
                "mb-1 flex w-full items-start gap-2 rounded-control px-2.5 py-2 text-left outline-none",
                "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                active ? "bg-panel shadow-[inset_0_0_0_1px_var(--line)]" : "hover:bg-bg/70",
              )}
              onClick={() => onSelect(zone)}
            >
              <ProviderGlyph brand={zone.provider === "vercel" ? "vercel" : "cloudflare"} className="mt-0.5 size-4 text-muted" />
              <span className="min-w-0">
                <span className="block truncate text-body font-medium text-ink">{zone.name}</span>
                <span className="mt-0.5 block truncate text-label text-muted">{zone.provider === "vercel" ? "Vercel DNS" : `${zone.status}${zone.planName ? ` · ${zone.planName}` : ""}`}</span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function ZoneFileMenu({ canImport, onImport, onExport }: { canImport: boolean; onImport: () => Promise<void>; onExport: () => Promise<void> }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild><Button size="sm" variant="outline" aria-label="DNS zone import and export">Zone file <ChevronDown aria-hidden /></Button></DropdownMenu.Trigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!canImport} onSelect={() => void onImport()}><FileUp aria-hidden /> Import BIND file</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onExport()}><Download aria-hidden /> Export zone</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu.Root>
  );
}

function DnsFilterControls({ zone, type, proxied, sort, onType, onProxy, onSort, stacked = false }: {
  zone: DnsZone;
  type: TypeFilter;
  proxied: ProxyFilter;
  sort: SortKey;
  onType: (type: TypeFilter) => void;
  onProxy: (proxied: ProxyFilter) => void;
  onSort: (sort: SortKey) => void;
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? "grid gap-2" : "contents"}>
      <DnsTypePicker provider={zone.provider} value={type} includeAll onValueChange={onType} className={stacked ? "w-full" : "w-36"} />
      {zone.provider === "cloudflare" ? <SelectControl value={proxied} onValueChange={(value) => onProxy(value as ProxyFilter)} options={PROXY_FILTER_OPTIONS} ariaLabel="Filter by proxy mode" className={stacked ? "w-full" : "w-36"} /> : null}
      <SelectControl value={sort} onValueChange={(value) => onSort(value as SortKey)} options={SORT_OPTIONS} ariaLabel="Sort DNS records" className={stacked ? "w-full" : "w-36"} />
    </div>
  );
}

function DnsRecordTable({ zone, records, selectedIds, allSelected, onToggleAll, onToggle, onEdit, onDelete }: {
  zone: DnsZone;
  records: DnsRecord[];
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggle: (record: DnsRecord) => void;
  onEdit: (record: DnsRecord, returnFocusTo?: HTMLElement | null) => void;
  onDelete: (record: DnsRecord) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="data-table data-table-fixed min-w-[900px]" aria-label={`DNS records for ${zone.name}`}>
        <colgroup><col className="w-10" /><col className="w-[72px]" /><col className="w-[22%]" /><col className="w-[28%]" /><col className="w-20" /><col className="w-16" /><col className="w-[72px]" /><col className="dns-modified-column w-[100px]" /><col className="w-14" /></colgroup>
        <thead><tr>
          <th><CheckboxControl checked={allSelected} onCheckedChange={onToggleAll} ariaLabel="Select all supported DNS records" /></th>
          <th>Type</th><th>Name</th><th>Content</th><th>Proxy</th><th data-numeric>TTL</th><th data-numeric>Priority</th><th className="dns-modified-column" data-numeric>Modified</th><th><span className="sr-only">Actions</span></th>
        </tr></thead>
        <tbody>{records.map((record) => {
          const selected = selectedIds.has(record.id);
          const unsupported = record.type === "UNKNOWN";
          return (
            <tr key={record.id} aria-selected={selected || undefined} tabIndex={0} onDoubleClick={(event) => onEdit(record, event.currentTarget)}>
              <td><CheckboxControl checked={selected} disabled={unsupported} onCheckedChange={() => onToggle(record)} ariaLabel={`Select ${displayType(record)} ${record.name}`} /></td>
              <td><Badge variant={unsupported ? "warning" : "outline"}>{displayType(record)}</Badge></td>
              <td className="truncate font-medium text-ink" title={record.name}>{record.name}</td>
              <td className="truncate font-mono text-dense text-muted" title={record.content || formatRecordData(record)}>{record.content || formatRecordData(record) || "—"}</td>
              <td>{record.proxied ? <Badge variant="accent">Proxied</Badge> : <span className="text-muted">DNS only</span>}</td>
              <td data-numeric className="font-mono text-dense">{record.ttl === 1 ? "Auto" : record.ttl}</td>
              <td data-numeric className="font-mono text-dense">{record.priority ?? numberFromData(record, "priority") ?? "—"}</td>
              <td data-numeric className="dns-modified-column text-muted">{formatWhen(record.modifiedOn, "relative")}</td>
              <td><DnsRecordActions record={record} unsupported={unsupported} onEdit={(trigger) => onEdit(record, trigger)} onDelete={() => onDelete(record)} /></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function DnsRecordActions({ record, unsupported, onEdit, onDelete }: { record: DnsRecord; unsupported: boolean; onEdit: (trigger: HTMLButtonElement | null) => void; onDelete: () => void }) {
  const copy = (label: string, value: string) => { void copyText(value); toast.success(`${label} copied`); };
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex justify-end">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button ref={triggerRef} size="icon-sm" variant="ghost" aria-label={`Actions for ${displayType(record)} ${record.name}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onSelect={() => onEdit(triggerRef.current)}><Pencil aria-hidden /> {unsupported ? "View raw record" : "Edit record"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => copy("Name", record.name)}><Copy aria-hidden /> Copy name</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copy("Value", record.content || formatRecordData(record))}><Copy aria-hidden /> Copy value</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copy("Record", `${displayType(record)} ${record.name} ${record.content || formatRecordData(record)}`)}><Copy aria-hidden /> Copy record</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={onDelete}><Trash2 aria-hidden /> Delete record</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu.Root>
    </div>
  );
}

export function DnsRecordEditor({ zone, state, canWrite, onClose, onDelete, onSave }: {
  zone: DnsZone;
  state: EditingState;
  canWrite: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onSave: (draft: DnsRecordDraft) => Promise<void>;
}) {
  const formId = useId();
  const [draft, setDraft] = useState<DnsRecordDraft | undefined>(state.draft);
  const [saving, setSaving] = useState(false);
  const errors = draft ? validateDnsRecordDraft(draft, zone.name, { enterpriseTtl: zone.planName?.toLowerCase().includes("enterprise") }) : {};
  const valid = draft && Object.keys(errors).length === 0;

  if (!draft || state.record?.type === "UNKNOWN") {
    return (
      <InspectorPanel size="md" className="dns-inspector overflow-hidden" onDismiss={onClose} returnFocusTo={state.returnFocusTo} aria-label="Unsupported DNS record inspector">
        <InspectorHeader title={`${displayType(state.record!)} DNS record`} subtitle={`${zone.name} · ${zone.provider}`} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <p className="text-body text-ink">This provider record type is newer than DeployDeck. Its original type and payload are preserved and shown read-only.</p>
          <dl className="mt-4 divide-y divide-line rounded-panel border border-line bg-panel">
            <RawRow label="Type" value={displayType(state.record!)} />
            <RawRow label="Name" value={state.record?.name ?? "—"} />
            <RawRow label="Content" value={state.record?.content ?? "—"} />
            <RawRow label="Data" value={JSON.stringify(state.record?.data ?? {}, null, 2)} mono />
          </dl>
        </div>
        <div className="flex min-h-14 items-center justify-between border-t border-line bg-panel-header px-4">
          {onDelete ? <Button size="sm" variant="ghost" className="text-failed-ink hover:bg-failed-soft" onClick={onDelete}>Delete record</Button> : <span />}
          <Button size="sm" variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </InspectorPanel>
    );
  }

  const definition = DNS_TYPE_DEFINITIONS[draft.type];
  const update = (patch: Partial<DnsRecordDraft>) => setDraft((current) => current ? { ...current, ...patch } : current);
  const updateValue = (key: string, value: string | number | boolean) => setDraft((current) => current ? { ...current, values: { ...current.values, [key]: value } } : current);
  const updateSetting = (key: string, value: string | number | boolean) => setDraft((current) => current ? { ...current, settings: { ...current.settings, [key]: value } } : current);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || saving || !canWrite) return;
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  };

  return (
    <InspectorPanel size="md" className="dns-inspector overflow-hidden" onDismiss={onClose} returnFocusTo={state.returnFocusTo} aria-label={`${state.record ? "Edit" : "Create"} DNS record`}>
      <InspectorHeader title={state.record ? "Edit DNS record" : "Create DNS record"} subtitle={`${zone.name} · ${zone.provider}`} onClose={onClose} closeLabel="Close DNS record editor" />
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submit(event)}>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <FormField label="Record type" className="col-span-2">
              <DnsTypePicker provider={zone.provider} value={draft.type} onValueChange={(next) => {
                if (next === "all") return;
                const fresh = createDnsRecordDraft(next, zone.name);
                setDraft({ ...fresh, name: draft.name, ttl: draft.ttl, comment: draft.comment, tags: draft.tags });
              }} className="w-full" />
            </FormField>
            <FormField label="Name" error={errors.name} hint={`Resolves to ${normalizeDnsName(draft.name, zone.name)}`} className="col-span-2">
              <Input id={`${formId}-name`} value={draft.name} onChange={(event) => update({ name: event.target.value })} aria-invalid={Boolean(errors.name)} placeholder="@ or subdomain" />
            </FormField>
            <div className="col-span-2 rounded-control bg-surface px-3 py-2 text-dense text-muted">{definition.description}</div>
            {definition.fields.map((field) => <DynamicField key={field.key} field={field} value={draft.values[field.key]} error={errors[field.key]} onChange={(value) => updateValue(field.key, value)} />)}
            <FormField label="TTL" error={errors.ttl} hint={zone.provider === "cloudflare" ? "Use 1 for Cloudflare automatic TTL." : "Vercel uses at least 60 seconds."}>
              <Input type="number" min={1} step={1} value={draft.ttl} onChange={(event) => update({ ttl: Number(event.target.value) })} aria-invalid={Boolean(errors.ttl)} />
            </FormField>
            {definition.proxyable && zone.provider === "cloudflare" ? (
              <FormField label="Proxy status"><label className="flex h-[34px] items-center gap-2 rounded-control border border-line bg-control px-3 text-body text-ink"><CheckboxControl checked={draft.proxied} onCheckedChange={(checked) => update({ proxied: checked })} ariaLabel="Proxy this DNS record through Cloudflare" /> Cloudflare proxy</label></FormField>
            ) : null}
            {draft.type === "CNAME" && zone.provider === "cloudflare" ? (
              <FormField label="CNAME flattening"><label className="flex h-[34px] items-center gap-2 rounded-control border border-line bg-control px-3 text-body text-ink"><CheckboxControl checked={Boolean(draft.settings.flatten_cname)} onCheckedChange={(checked) => updateSetting("flatten_cname", checked)} ariaLabel="Flatten this CNAME record" /> Flatten externally</label></FormField>
            ) : null}
            {(draft.type === "A" || draft.type === "AAAA") && zone.provider === "cloudflare" ? (
              <div className="col-span-2 grid grid-cols-2 gap-3 rounded-control border border-line bg-surface p-3">
                <label className="flex items-center gap-2 text-dense text-ink"><CheckboxControl checked={Boolean(draft.settings.ipv4_only)} onCheckedChange={(checked) => updateSetting("ipv4_only", checked)} ariaLabel="Generate IPv4 only" /> IPv4 only</label>
                <label className="flex items-center gap-2 text-dense text-ink"><CheckboxControl checked={Boolean(draft.settings.ipv6_only)} onCheckedChange={(checked) => updateSetting("ipv6_only", checked)} ariaLabel="Generate IPv6 only" /> IPv6 only</label>
              </div>
            ) : null}
            <FormField label="Tags" hint="Comma-separated Cloudflare tags." className="col-span-2"><Input value={draft.tags.join(", ")} onChange={(event) => update({ tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} disabled={zone.provider !== "cloudflare"} placeholder="team:platform, env:production" /></FormField>
            <FormField label="Comment" className="col-span-2"><Input value={draft.comment} onChange={(event) => update({ comment: event.target.value })} placeholder="Why this record exists" /></FormField>
          </div>
        </div>
        <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-t border-line bg-panel-header px-4 py-2.5">
          {onDelete ? <Button type="button" size="sm" variant="ghost" className="text-failed-ink hover:bg-failed-soft" disabled={saving} onClick={onDelete}>Delete record</Button> : <span />}
          <div className="flex gap-2"><Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" size="sm" loading={saving} disabled={!valid || !canWrite}>{state.record ? "Save changes" : "Create record"}</Button></div>
        </div>
      </form>
    </InspectorPanel>
  );
}

function DynamicField({ field, value, error, onChange }: { field: DnsFieldDefinition; value: string | number | boolean | undefined; error?: string; onChange: (value: string | number | boolean) => void }) {
  const common = { "aria-invalid": Boolean(error), placeholder: field.placeholder };
  return (
    <FormField label={field.label} hint={field.hint} error={error} className={field.input === "textarea" ? "col-span-2" : undefined}>
      {field.input === "textarea" ? <Textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} {...common} />
        : field.input === "select" ? <SelectControl value={String(value ?? field.defaultValue ?? "")} onValueChange={onChange} options={field.options ?? []} ariaLabel={field.label} className="w-full" />
          : <Input type={field.input === "number" ? "number" : "text"} min={field.min} max={field.max} step={field.step} value={value === undefined ? "" : String(value)} onChange={(event) => onChange(field.input === "number" ? Number(event.target.value) : event.target.value)} {...common} />}
    </FormField>
  );
}

export function DnsTypePicker({ provider, value, onValueChange, includeAll = false, className }: { provider: DnsProvider; value: TypeFilter; onValueChange: (value: TypeFilter) => void; includeAll?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const types = dnsTypesForProvider(provider);
  const filtered = types.filter((item) => !query || `${item} ${DNS_TYPE_DEFINITIONS[item].description}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <Popover.Trigger asChild><Button variant="outline" className={cn("justify-between font-normal", className)} aria-label="DNS record type"><span className="truncate">{value === "all" ? "All types" : value}</span><ChevronDown aria-hidden /></Button></Popover.Trigger>
      <Popover.Portal><Popover.Content align="start" sideOffset={4} collisionPadding={8} className="z-[var(--z-dropdown)] w-80 rounded-panel bg-panel p-1 shadow-[var(--shadow-popover)]">
        <div className="relative m-1"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" aria-hidden /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search record types" className="pl-8" /></div>
        <div className="max-h-72 overflow-auto p-1">
          {includeAll && !query ? <TypeOption active={value === "all"} label="All types" description="Show every supported type" onSelect={() => { onValueChange("all"); setOpen(false); }} /> : null}
          {DNS_TYPE_GROUPS.map((group) => {
            const groupTypes = filtered.filter((item) => DNS_TYPE_DEFINITIONS[item].group === group);
            if (groupTypes.length === 0) return null;
            return <div key={group} className="mt-1 first:mt-0"><p className="px-2 py-1 text-micro font-medium text-subtle">{group}</p>{groupTypes.map((item) => <TypeOption key={item} active={value === item} label={item} description={DNS_TYPE_DEFINITIONS[item].description} onSelect={() => { onValueChange(item); setOpen(false); }} />)}</div>;
          })}
        </div>
      </Popover.Content></Popover.Portal>
    </Popover.Root>
  );
}

function TypeOption({ active, label, description, onSelect }: { active: boolean; label: string; description: string; onSelect: () => void }) {
  return <button type="button" className="flex w-full items-start gap-2 rounded-control px-2 py-1.5 text-left outline-none hover:bg-surface-2 focus-visible:bg-surface-2" onClick={onSelect}><span className="mt-0.5 grid size-4 shrink-0 place-items-center text-brand-ink">{active ? <Check className="size-3.5" aria-hidden /> : null}</span><span className="min-w-0"><span className="block text-dense font-medium text-ink">{label}</span><span className="block truncate text-label text-muted">{description}</span></span></button>;
}

function FormField({ label, hint, error, className, children }: { label: string; hint?: string; error?: string; className?: string; children: ReactNode }) {
  return <div className={cn("space-y-1.5", className)}><Label className="text-ink">{label}</Label>{children}{error ? <p className="text-label text-failed-ink">{error}</p> : hint ? <p className="text-label text-muted">{hint}</p> : null}</div>;
}

function RawRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="grid grid-cols-[110px_1fr] gap-3 px-3 py-2"><dt className="text-dense text-muted">{label}</dt><dd className={cn("min-w-0 break-words text-dense text-ink", mono && "whitespace-pre-wrap font-mono")}>{value}</dd></div>;
}

function displayType(record: DnsRecord): string { return record.rawType ?? record.type; }
function zoneKey(zone: DnsZone): string { return `${zone.provider}:${zone.id}`; }
function numberFromData(record: DnsRecord, key: string): number | undefined { const value = record.data?.[key]; return typeof value === "number" ? value : undefined; }
function formatRecordData(record: DnsRecord): string { return Object.values(record.data ?? {}).filter((value) => value !== undefined && value !== "").join(" "); }
function withValue(source: Set<string>, value: string): Set<string> { const next = new Set(source); next.add(value); return next; }
function without(source: Set<string>, value: string): Set<string> { const next = new Set(source); next.delete(value); return next; }

export function previewBindZone(contents: string, zoneName: string, existing: DnsRecord[]): { parsed: number; conflicts: string[] } {
  const supported = new Set(dnsTypesForProvider("cloudflare"));
  const candidates: Array<{ type: string; name: string }> = [];
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.replace(/\s;.*$/, "").trim();
    if (!line || line.startsWith("$") || line === "(" || line === ")") continue;
    const tokens = line.match(/"(?:\\.|[^"\\])*"|\S+/g) ?? [];
    const typeIndex = tokens.findIndex((token) => supported.has(token.toUpperCase() as SupportedDnsRecordType));
    if (typeIndex <= 0) continue;
    const type = tokens[typeIndex]!.toUpperCase();
    const name = normalizeDnsName(tokens[0]!, zoneName);
    candidates.push({ type, name });
  }
  const existingKeys = new Set(existing.map((record) => `${displayType(record).toUpperCase()}:${normalizeDnsName(record.name, zoneName)}`));
  const conflicts = [...new Set(candidates.filter((item) => existingKeys.has(`${item.type}:${item.name}`)).map((item) => `${item.type} ${item.name}`))];
  return { parsed: candidates.length, conflicts };
}
