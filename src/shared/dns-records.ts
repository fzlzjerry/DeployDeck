import type {
  CloudflareDnsRecordType,
  DnsProvider,
  DnsRecord,
  SupportedDnsRecordType,
  VercelDnsRecordType,
} from "./models";

export const CLOUDFLARE_DNS_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "NS",
  "OPENPGPKEY",
  "PTR",
  "TXT",
  "CAA",
  "CERT",
  "DNSKEY",
  "DS",
  "HTTPS",
  "LOC",
  "NAPTR",
  "SMIMEA",
  "SRV",
  "SSHFP",
  "SVCB",
  "TLSA",
  "URI",
] as const satisfies readonly CloudflareDnsRecordType[];

export const VERCEL_DNS_TYPES = [
  "A",
  "AAAA",
  "ALIAS",
  "CAA",
  "CNAME",
  "HTTPS",
  "MX",
  "NS",
  "SRV",
  "TXT",
] as const satisfies readonly VercelDnsRecordType[];

const CLOUDFLARE_TYPE_SET = new Set<string>(CLOUDFLARE_DNS_TYPES);
const VERCEL_TYPE_SET = new Set<string>(VERCEL_DNS_TYPES);

export function isCloudflareDnsRecordType(value: string): value is CloudflareDnsRecordType {
  return CLOUDFLARE_TYPE_SET.has(value.toUpperCase());
}

export function isVercelDnsRecordType(value: string): value is VercelDnsRecordType {
  return VERCEL_TYPE_SET.has(value.toUpperCase());
}

export function isSupportedDnsRecordType(value: string): value is SupportedDnsRecordType {
  return isCloudflareDnsRecordType(value) || isVercelDnsRecordType(value);
}

export function dnsTypesForProvider(provider: DnsProvider): readonly SupportedDnsRecordType[] {
  return provider === "cloudflare" ? CLOUDFLARE_DNS_TYPES : VERCEL_DNS_TYPES;
}

export type DnsFieldInput = "text" | "textarea" | "number" | "select";

export interface DnsFieldOption {
  value: string;
  label: string;
}

export interface DnsFieldDefinition {
  key: string;
  label: string;
  input: DnsFieldInput;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly DnsFieldOption[];
  defaultValue?: string | number;
}

export type DnsTypeGroup = "Common" | "Routing" | "Security" | "Modern" | "Specialized";

export interface DnsTypeDefinition {
  type: SupportedDnsRecordType;
  group: DnsTypeGroup;
  description: string;
  fields: readonly DnsFieldDefinition[];
  proxyable?: boolean;
}

const text = (
  key: string,
  label: string,
  placeholder: string,
  options: Partial<DnsFieldDefinition> = {},
): DnsFieldDefinition => ({ key, label, input: "text", placeholder, required: true, ...options });

const number = (
  key: string,
  label: string,
  defaultValue: number,
  min = 0,
  max = 65535,
): DnsFieldDefinition => ({
  key,
  label,
  input: "number",
  required: true,
  min,
  max,
  step: 1,
  defaultValue,
});

const select = (
  key: string,
  label: string,
  options: readonly DnsFieldOption[],
  defaultValue: string,
): DnsFieldDefinition => ({ key, label, input: "select", required: true, options, defaultValue });

const usageOptions: readonly DnsFieldOption[] = [
  { value: "0", label: "0 · PKIX-TA" },
  { value: "1", label: "1 · PKIX-EE" },
  { value: "2", label: "2 · DANE-TA" },
  { value: "3", label: "3 · DANE-EE" },
];

const selectorOptions: readonly DnsFieldOption[] = [
  { value: "0", label: "0 · Full certificate" },
  { value: "1", label: "1 · Subject public key" },
];

const matchingOptions: readonly DnsFieldOption[] = [
  { value: "0", label: "0 · Exact" },
  { value: "1", label: "1 · SHA-256" },
  { value: "2", label: "2 · SHA-512" },
];

const definitions: readonly DnsTypeDefinition[] = [
  {
    type: "A",
    group: "Common",
    description: "Maps a hostname to an IPv4 address.",
    proxyable: true,
    fields: [text("content", "IPv4 address", "192.0.2.1")],
  },
  {
    type: "AAAA",
    group: "Common",
    description: "Maps a hostname to an IPv6 address.",
    proxyable: true,
    fields: [text("content", "IPv6 address", "2001:db8::1")],
  },
  {
    type: "ALIAS",
    group: "Common",
    description: "Vercel apex alias pointing to another hostname.",
    fields: [text("content", "Target", "target.example.com")],
  },
  {
    type: "CNAME",
    group: "Common",
    description: "Maps a hostname to another canonical hostname.",
    proxyable: true,
    fields: [text("content", "Target", "target.example.com")],
  },
  {
    type: "TXT",
    group: "Common",
    description: "Stores verification, email policy, or other text data.",
    fields: [{ ...text("content", "Content", "Text value"), input: "textarea" }],
  },
  {
    type: "MX",
    group: "Common",
    description: "Routes email to a mail server.",
    fields: [
      text("content", "Mail server", "mail.example.com"),
      number("priority", "Priority", 10),
    ],
  },
  {
    type: "NS",
    group: "Routing",
    description: "Delegates a hostname to an authoritative nameserver.",
    fields: [text("content", "Nameserver", "ns1.example.net")],
  },
  {
    type: "PTR",
    group: "Routing",
    description: "Maps a reverse-DNS address to a hostname.",
    fields: [text("content", "Target", "host.example.com")],
  },
  {
    type: "SRV",
    group: "Routing",
    description: "Publishes the location, port, and weight of a service.",
    fields: [
      text("service", "Service", "sip", { hint: "Enter without the leading underscore." }),
      select(
        "protocol",
        "Protocol",
        [
          { value: "tcp", label: "TCP" },
          { value: "udp", label: "UDP" },
          { value: "tls", label: "TLS" },
        ],
        "tcp",
      ),
      number("priority", "Priority", 10),
      number("weight", "Weight", 10),
      number("port", "Port", 443, 1, 65535),
      text("target", "Target", "service.example.com"),
    ],
  },
  {
    type: "URI",
    group: "Routing",
    description: "Maps a service name to a URI target.",
    fields: [number("priority", "Priority", 10), number("weight", "Weight", 10), text("target", "Target URI", "https://example.com/service")],
  },
  {
    type: "NAPTR",
    group: "Routing",
    description: "Publishes ordered rewrite rules for service discovery.",
    fields: [
      number("order", "Order", 10),
      number("preference", "Preference", 10),
      text("flags", "Flags", "S"),
      text("service", "Service", "SIP+D2U"),
      text("regex", "Regular expression", "!^.*$!sip:info@example.com!", { required: false }),
      text("replacement", "Replacement", "."),
    ],
  },
  {
    type: "CAA",
    group: "Security",
    description: "Controls which certificate authorities may issue certificates.",
    fields: [
      number("flags", "Flags", 0, 0, 255),
      select(
        "tag",
        "Tag",
        [
          { value: "issue", label: "issue" },
          { value: "issuewild", label: "issuewild" },
          { value: "iodef", label: "iodef" },
        ],
        "issue",
      ),
      text("value", "Value", "letsencrypt.org"),
    ],
  },
  {
    type: "CERT",
    group: "Security",
    description: "Publishes a certificate or certificate revocation list.",
    fields: [
      number("type", "Certificate type", 1),
      number("keyTag", "Key tag", 0),
      number("algorithm", "Algorithm", 8),
      { ...text("certificate", "Certificate", "Base64 certificate"), input: "textarea" },
    ],
  },
  {
    type: "DNSKEY",
    group: "Security",
    description: "Publishes a DNSSEC public key.",
    fields: [
      number("flags", "Flags", 257),
      number("protocol", "Protocol", 3, 0, 255),
      number("algorithm", "Algorithm", 13, 0, 255),
      { ...text("publicKey", "Public key", "Base64 public key"), input: "textarea" },
    ],
  },
  {
    type: "DS",
    group: "Security",
    description: "Publishes a DNSSEC delegation signer digest.",
    fields: [
      number("keyTag", "Key tag", 0),
      number("algorithm", "Algorithm", 13, 0, 255),
      number("digestType", "Digest type", 2, 0, 255),
      { ...text("digest", "Digest", "Hex digest"), input: "textarea" },
    ],
  },
  {
    type: "SSHFP",
    group: "Security",
    description: "Publishes an SSH host-key fingerprint.",
    fields: [
      number("algorithm", "Algorithm", 4, 1, 6),
      number("fingerprintType", "Fingerprint type", 2, 1, 2),
      { ...text("fingerprint", "Fingerprint", "Hex fingerprint"), input: "textarea" },
    ],
  },
  {
    type: "TLSA",
    group: "Security",
    description: "Associates a TLS certificate with a service using DANE.",
    fields: [
      select("usage", "Certificate usage", usageOptions, "3"),
      select("selector", "Selector", selectorOptions, "1"),
      select("matchingType", "Matching type", matchingOptions, "1"),
      { ...text("certificate", "Certificate association", "Hex or certificate data"), input: "textarea" },
    ],
  },
  {
    type: "SMIMEA",
    group: "Security",
    description: "Associates an S/MIME certificate with an email address.",
    fields: [
      select("usage", "Certificate usage", usageOptions, "3"),
      select("selector", "Selector", selectorOptions, "1"),
      select("matchingType", "Matching type", matchingOptions, "1"),
      { ...text("certificate", "Certificate association", "Hex or certificate data"), input: "textarea" },
    ],
  },
  {
    type: "OPENPGPKEY",
    group: "Security",
    description: "Publishes an OpenPGP transferable public key.",
    fields: [{ ...text("content", "Public key", "Base64 OpenPGP key"), input: "textarea" }],
  },
  {
    type: "HTTPS",
    group: "Modern",
    description: "Publishes HTTPS service priority, target, and service parameters.",
    fields: [
      number("priority", "Priority", 1),
      text("target", "Target", "."),
      text("value", "Service parameters", "alpn=\"h2,h3\""),
    ],
  },
  {
    type: "SVCB",
    group: "Modern",
    description: "Publishes a generic service binding.",
    fields: [
      number("priority", "Priority", 1),
      text("target", "Target", "."),
      text("value", "Service parameters", "alpn=\"h2\""),
    ],
  },
  {
    type: "LOC",
    group: "Specialized",
    description: "Publishes a geographic location and precision.",
    fields: [
      number("latDegrees", "Latitude degrees", 0, 0, 90),
      number("latMinutes", "Latitude minutes", 0, 0, 59),
      number("latSeconds", "Latitude seconds", 0, 0, 59),
      select("latDirection", "Latitude direction", [{ value: "N", label: "North" }, { value: "S", label: "South" }], "N"),
      number("longDegrees", "Longitude degrees", 0, 0, 180),
      number("longMinutes", "Longitude minutes", 0, 0, 59),
      number("longSeconds", "Longitude seconds", 0, 0, 59),
      select("longDirection", "Longitude direction", [{ value: "E", label: "East" }, { value: "W", label: "West" }], "E"),
      number("altitude", "Altitude (m)", 0, -100000, 42849672),
      number("size", "Size (m)", 1, 0, 90000000),
      number("precisionHorz", "Horizontal precision (m)", 10000, 0, 90000000),
      number("precisionVert", "Vertical precision (m)", 10, 0, 90000000),
    ],
  },
];

export const DNS_TYPE_DEFINITIONS: Readonly<Record<SupportedDnsRecordType, DnsTypeDefinition>> = Object.freeze(
  Object.fromEntries(definitions.map((definition) => [definition.type, definition])) as Record<
    SupportedDnsRecordType,
    DnsTypeDefinition
  >,
);

export const DNS_TYPE_GROUPS: readonly DnsTypeGroup[] = ["Common", "Routing", "Security", "Modern", "Specialized"];

export interface DnsRecordDraft {
  type: SupportedDnsRecordType;
  name: string;
  ttl: number;
  proxied: boolean;
  comment: string;
  tags: string[];
  values: Record<string, string | number | boolean>;
  settings: Record<string, string | number | boolean>;
}

export interface DnsRecordWrite {
  provider: DnsProvider;
  zoneId: string;
  type: SupportedDnsRecordType;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  priority?: number;
  comment?: string;
  tags?: string[];
  data?: Record<string, string | number | boolean | undefined>;
  settings?: Record<string, string | number | boolean | undefined>;
}

export function createDnsRecordDraft(type: SupportedDnsRecordType, zoneName: string): DnsRecordDraft {
  const definition = DNS_TYPE_DEFINITIONS[type];
  const values: DnsRecordDraft["values"] = {};
  for (const field of definition.fields) {
    if (field.defaultValue !== undefined) values[field.key] = field.defaultValue;
  }
  return {
    type,
    name: zoneName,
    ttl: 1,
    proxied: false,
    comment: "",
    tags: [],
    values,
    settings: {},
  };
}

export function normalizeDnsName(value: string, zoneName: string): string {
  const input = value.trim().replace(/\.$/, "");
  const zone = zoneName.trim().toLowerCase().replace(/\.$/, "");
  if (!input || input === "@") return zone;
  const lower = input.toLowerCase();
  if (lower === zone || lower.endsWith(`.${zone}`)) return lower;
  return `${lower}.${zone}`;
}

function removeSuffix(value: string, suffix: string): string {
  const lower = value.toLowerCase();
  const normalizedSuffix = suffix.toLowerCase();
  if (lower === normalizedSuffix) return "@";
  if (lower.endsWith(`.${normalizedSuffix}`)) return value.slice(0, -(normalizedSuffix.length + 1));
  return value;
}

function fieldValue(record: DnsRecord, key: string): string | number | boolean | undefined {
  const snake = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  return record.data?.[key] ?? record.data?.[snake] ?? record.settings?.[key] ?? record.settings?.[snake];
}

export function dnsDraftFromRecord(record: DnsRecord): DnsRecordDraft | undefined {
  if (record.type === "UNKNOWN") return undefined;
  const draft = createDnsRecordDraft(record.type, record.zoneName);
  draft.name = removeSuffix(record.name, record.zoneName);
  draft.ttl = record.ttl;
  draft.proxied = Boolean(record.proxied);
  draft.comment = record.comment ?? "";
  draft.tags = record.tags;
  draft.settings = { ...(record.settings ?? {}) } as DnsRecordDraft["settings"];
  const definition = DNS_TYPE_DEFINITIONS[record.type];
  for (const field of definition.fields) {
    let value = fieldValue(record, field.key);
    if (field.key === "content") value = record.content;
    if (field.key === "priority") value = record.priority ?? value;
    if (record.type === "CAA" && field.key === "value") value = fieldValue(record, "value") ?? record.content;
    if (value !== undefined) draft.values[field.key] = value;
  }
  if (record.type === "SRV") {
    const relative = removeSuffix(record.name, record.zoneName);
    const match = relative.match(/^_([^.]*)\._([^.]*)\.(.*)$/);
    if (match) {
      draft.values.service = match[1] ?? "";
      draft.values.protocol = match[2] ?? "tcp";
      draft.name = match[3] || "@";
    }
  }
  return draft;
}

export function validateDnsRecordDraft(
  draft: DnsRecordDraft,
  zoneName: string,
  options: { enterpriseTtl?: boolean } = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  const normalizedName = normalizeDnsName(draft.name, zoneName);
  if (!normalizedName || normalizedName.length > 253) errors.name = "Enter a valid DNS name up to 253 characters.";
  const ttlMin = options.enterpriseTtl ? 30 : 60;
  if (draft.ttl !== 1 && (!Number.isInteger(draft.ttl) || draft.ttl < ttlMin || draft.ttl > 86400)) {
    errors.ttl = `Use Auto (1) or a TTL between ${ttlMin} and 86400 seconds.`;
  }
  const definition = DNS_TYPE_DEFINITIONS[draft.type];
  for (const field of definition.fields) {
    const value = draft.values[field.key];
    if (field.required && (value === undefined || String(value).trim() === "")) {
      errors[field.key] = `${field.label} is required.`;
      continue;
    }
    if (field.input === "number" && value !== undefined) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || (field.min !== undefined && numeric < field.min) || (field.max !== undefined && numeric > field.max)) {
        errors[field.key] = `${field.label} must be between ${field.min ?? "−∞"} and ${field.max ?? "∞"}.`;
      }
    }
  }
  const content = String(draft.values.content ?? "").trim();
  if (draft.type === "A" && content && !isIpv4(content)) errors.content = "Enter a valid IPv4 address.";
  if (draft.type === "AAAA" && content && !isIpv6(content)) errors.content = "Enter a valid IPv6 address.";
  return errors;
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isIpv6(value: string): boolean {
  return value.includes(":") && /^[0-9a-f:]+$/i.test(value);
}

function numericValues(values: DnsRecordDraft["values"], keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [toSnake(key), Number(values[key] ?? 0)]));
}

function toSnake(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function serializeDnsRecordDraft(
  draft: DnsRecordDraft,
  provider: DnsProvider,
  zoneId: string,
  zoneName: string,
): DnsRecordWrite {
  let name = normalizeDnsName(draft.name, zoneName);
  const values = draft.values;
  let content = String(values.content ?? values.value ?? values.target ?? values.certificate ?? values.digest ?? "").trim();
  let priority: number | undefined;
  let data: DnsRecordWrite["data"];

  switch (draft.type) {
    case "MX":
      priority = Number(values.priority ?? 10);
      break;
    case "CAA":
      data = { flags: Number(values.flags ?? 0), tag: String(values.tag ?? "issue"), value: String(values.value ?? "") };
      content = String(values.value ?? "");
      break;
    case "CERT":
      data = {
        type: Number(values.type ?? 1),
        key_tag: Number(values.keyTag ?? 0),
        algorithm: Number(values.algorithm ?? 8),
        certificate: String(values.certificate ?? ""),
      };
      break;
    case "DNSKEY":
      data = {
        flags: Number(values.flags ?? 257),
        protocol: Number(values.protocol ?? 3),
        algorithm: Number(values.algorithm ?? 13),
        public_key: String(values.publicKey ?? ""),
      };
      break;
    case "DS":
      data = {
        key_tag: Number(values.keyTag ?? 0),
        algorithm: Number(values.algorithm ?? 13),
        digest_type: Number(values.digestType ?? 2),
        digest: String(values.digest ?? ""),
      };
      break;
    case "HTTPS":
    case "SVCB":
      data = { priority: Number(values.priority ?? 1), target: String(values.target ?? "."), value: String(values.value ?? "") };
      break;
    case "LOC":
      data = {
        ...numericValues(values, [
          "altitude",
          "latDegrees",
          "latMinutes",
          "latSeconds",
          "longDegrees",
          "longMinutes",
          "longSeconds",
          "precisionHorz",
          "precisionVert",
          "size",
        ]),
        lat_direction: String(values.latDirection ?? "N"),
        long_direction: String(values.longDirection ?? "E"),
      };
      break;
    case "NAPTR":
      data = {
        order: Number(values.order ?? 10),
        preference: Number(values.preference ?? 10),
        flags: String(values.flags ?? ""),
        service: String(values.service ?? ""),
        regex: String(values.regex ?? ""),
        replacement: String(values.replacement ?? "."),
      };
      break;
    case "SMIMEA":
    case "TLSA":
      data = {
        usage: Number(values.usage ?? 3),
        selector: Number(values.selector ?? 1),
        matching_type: Number(values.matchingType ?? 1),
        certificate: String(values.certificate ?? ""),
      };
      break;
    case "SRV": {
      const service = String(values.service ?? "").replace(/^_/, "");
      const protocol = String(values.protocol ?? "tcp").replace(/^_/, "");
      name = `_${service}._${protocol}.${normalizeDnsName(draft.name, zoneName)}`;
      data = {
        priority: Number(values.priority ?? 10),
        weight: Number(values.weight ?? 10),
        port: Number(values.port ?? 443),
        target: String(values.target ?? ""),
      };
      priority = Number(values.priority ?? 10);
      content = String(values.target ?? "");
      break;
    }
    case "SSHFP":
      data = {
        algorithm: Number(values.algorithm ?? 4),
        type: Number(values.fingerprintType ?? 2),
        fingerprint: String(values.fingerprint ?? ""),
      };
      break;
    case "URI":
      priority = Number(values.priority ?? 10);
      data = { weight: Number(values.weight ?? 10), target: String(values.target ?? "") };
      content = String(values.target ?? "");
      break;
    default:
      break;
  }

  return {
    provider,
    zoneId,
    type: draft.type,
    name,
    content,
    ttl: draft.ttl,
    proxied: DNS_TYPE_DEFINITIONS[draft.type].proxyable ? draft.proxied : undefined,
    priority,
    comment: draft.comment.trim() || undefined,
    tags: draft.tags.length ? draft.tags : undefined,
    data,
    settings: Object.keys(draft.settings).length ? draft.settings : undefined,
  };
}

