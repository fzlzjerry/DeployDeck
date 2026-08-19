import type {
  DeploymentLogEntry,
  DnsRecord,
  DnsRecordType,
  DnsZone,
  EnvironmentVariable,
  PagesDeploymentDetail,
  UnifiedDeployment,
  UnifiedDomain,
  UnifiedProject,
  WorkerDeployment,
  WorkerScript,
  WorkerVersion,
} from "@shared/models";
import { pagesVerificationRecords } from "@shared/domain-verification";
import {
  cloudflarePagesDeploymentUrl,
  cloudflarePagesUrl,
  cloudflareWorkerUrl,
  gitRepositoryUrl,
  httpsUrl,
} from "@shared/provider-types";
import { redactJson } from "@shared/redact";
import { inferLogLevel, pagesEnvironment, pagesState } from "@shared/status";

interface LooseRecord {
  [key: string]: unknown;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

const DNS_TYPES = new Set<DnsRecordType>(["A", "AAAA", "CNAME", "TXT", "MX", "CAA", "SRV", "NS"]);

export function normalizePagesProject(project: LooseRecord, account: { id: string; name: string }): UnifiedProject {
  const source = (project.source ?? {}) as LooseRecord;
  const config = (source.config ?? {}) as LooseRecord;
  const build = (project.build_config ?? {}) as LooseRecord;
  const latest = (project.canonical_deployment ?? project.latest_deployment ?? {}) as LooseRecord;
  const domains = Array.isArray(project.domains) ? (project.domains as string[]) : [];
  const repoOwner = text(config.owner);
  const repoName = text(config.repo_name);
  const repo = repoOwner && repoName ? `${repoOwner}/${repoName}` : undefined;
  return {
    id: String(project.name ?? project.id),
    provider: "cloudflare-pages",
    accountId: account.id,
    accountName: account.name,
    name: String(project.name ?? ""),
    productionBranch: text(project.production_branch),
    rootDirectory: text(build.root_dir),
    buildCommand: text(build.build_command),
    outputDirectory: text(build.destination_dir),
    repository: repo,
    repositoryUrl: gitRepositoryUrl(repo),
    domains,
    productionUrl: text(project.subdomain) ? httpsUrl(`${project.subdomain as string}.pages.dev`) : undefined,
    latestDeploymentId: text(latest.id),
    latestDeploymentState: pagesState(text((latest.latest_stage as LooseRecord | undefined)?.status) ?? text(latest.status)),
    latestDeploymentAt: text(latest.modified_on) ?? text(latest.created_on),
    updatedAt: text(project.created_on) ?? new Date().toISOString(),
    dashboardUrl: cloudflarePagesUrl(account.id, String(project.name ?? "")),
  };
}

export function normalizePagesDeployment(
  deployment: LooseRecord,
  projectName: string,
  account: { id: string; name: string },
): UnifiedDeployment {
  const latest = (deployment.latest_stage ?? {}) as LooseRecord;
  const trigger = (deployment.deployment_trigger ?? {}) as LooseRecord;
  const metadata = (trigger.metadata ?? {}) as LooseRecord;
  const created = text(deployment.created_on);
  const modified = text(deployment.modified_on);
  const aliases = Array.isArray(deployment.aliases) ? (deployment.aliases as string[]) : [];
  return {
    id: String(deployment.id ?? ""),
    provider: "cloudflare-pages",
    accountId: account.id,
    accountName: account.name,
    projectId: projectName,
    projectName,
    state: pagesState(text(latest.status) ?? text(deployment.status)),
    environment: pagesEnvironment(text(deployment.environment)),
    url: text(deployment.url) ? httpsUrl(String(deployment.url)) : undefined,
    aliases: aliases.map(httpsUrl),
    branch: text(metadata.branch) ?? text(deployment.production_branch),
    commitSha: text(metadata.commit_hash),
    commitMessage: text(metadata.commit_message),
    author: text(metadata.commit_author) ?? text(trigger.type),
    createdAt: created ?? new Date().toISOString(),
    startedAt: created,
    completedAt: modified,
    durationMs: created && modified ? Math.max(0, Date.parse(modified) - Date.parse(created)) : undefined,
  };
}

export function normalizePagesDeploymentDetail(
  deployment: LooseRecord,
  projectName: string,
  account: { id: string; name: string },
): PagesDeploymentDetail {
  const stagesRaw = Array.isArray(deployment.stages) ? (deployment.stages as LooseRecord[]) : [];
  const stages = stagesRaw.map((stage) => {
    const started = text(stage.started_on);
    const ended = text(stage.ended_on);
    return {
      name: String(stage.name ?? "unknown"),
      status: String(stage.status ?? "unknown"),
      startedOn: started,
      endedOn: ended,
      durationMs: started && ended ? Math.max(0, Date.parse(ended) - Date.parse(started)) : undefined,
    };
  });
  const trigger = (deployment.deployment_trigger ?? {}) as LooseRecord;
  const buildConfig = (deployment.build_config ?? {}) as Record<string, string | undefined>;
  return {
    ...normalizePagesDeployment(deployment, projectName, account),
    trigger: text(trigger.type),
    latestStage: text((deployment.latest_stage as LooseRecord | undefined)?.name),
    stages,
    buildConfig,
    dashboardUrl: cloudflarePagesDeploymentUrl(account.id, projectName, String(deployment.id ?? "")),
    metadata: redactJson(deployment),
  };
}

export function normalizePagesDomain(
  domain: LooseRecord,
  projectName: string,
  account: { id: string; name: string },
): UnifiedDomain {
  const validation = (domain.validation_data ?? {}) as LooseRecord;
  const cert = (domain.verification_data ?? domain.certificate ?? {}) as LooseRecord;
  return {
    id: `${account.id}:${projectName}:${String(domain.name ?? domain.id ?? "")}`,
    provider: "cloudflare-pages",
    accountId: account.id,
    accountName: account.name,
    projectId: projectName,
    projectName,
    name: String(domain.name ?? domain.id ?? ""),
    status: text(domain.status) ?? "unknown",
    verified: text(domain.status) === "active",
    certificateStatus: text(cert.status) ?? text(domain.certificate_status),
    verificationStatus: text(validation.status) ?? text(domain.status),
    verificationRecords: pagesVerificationRecords(domain, projectName),
  };
}

export function normalizePagesLogs(lines: Array<{ line?: string; ts?: string }>): DeploymentLogEntry[] {
  return lines.map((item, index) => ({
    id: `pages-log-${index}`,
    timestamp: item.ts,
    level: inferLogLevel(item.line ?? ""),
    message: item.line ?? "",
    source: "pages-build",
  }));
}

export function normalizePagesEnv(
  name: string,
  value: LooseRecord,
  projectName: string,
  accountId: string,
  environment: string,
): EnvironmentVariable {
  const type = text(value.type) === "secret_text" ? "secret" : "plain";
  return {
    id: `${accountId}:${projectName}:${environment}:${name}`,
    provider: "cloudflare-pages",
    accountId,
    projectId: projectName,
    projectName,
    key: name,
    type,
    targets: [environment],
    valueMasked: true,
    value: type === "secret" ? undefined : text(value.value),
  };
}

export function normalizeWorkerScript(script: LooseRecord, account: { id: string; name: string }, extras?: {
  routes?: string[];
  domains?: string[];
  activeVersionId?: string;
  activeDeploymentId?: string;
  tailConsumers?: string[];
}): WorkerScript {
  return {
    id: String(script.id ?? script.id ?? script),
    accountId: account.id,
    accountName: account.name,
    name: String(script.id ?? ""),
    modifiedOn: text(script.modified_on) ?? text(script.created_on),
    compatibilityDate: text(script.compatibility_date),
    compatibilityFlags: Array.isArray(script.compatibility_flags) ? (script.compatibility_flags as string[]) : [],
    activeDeploymentId: extras?.activeDeploymentId,
    activeVersionId: extras?.activeVersionId,
    tailConsumers: extras?.tailConsumers ?? [],
    routes: extras?.routes ?? [],
    domains: extras?.domains ?? [],
    dashboardUrl: cloudflareWorkerUrl(account.id, String(script.id ?? "")),
  };
}

export function normalizeWorkerVersion(
  version: LooseRecord,
  scriptName: string,
  accountId: string,
  traffic?: number,
): WorkerVersion {
  const annotations = (version.annotations ?? {}) as LooseRecord;
  const metadata = (version.metadata ?? {}) as LooseRecord;
  return {
    id: String(version.id ?? ""),
    scriptName,
    accountId,
    message: text(annotations["workers/message"]) ?? text(metadata.source),
    tag: text(annotations["workers/tag"]),
    createdOn: text(version.created_on) ?? text(metadata.created_on),
    source: text(metadata.source),
    compatibilityDate: text(
      ((version.resources as LooseRecord | undefined)?.script as LooseRecord | undefined)?.runtime
        ? (((version.resources as LooseRecord).script as LooseRecord).runtime as LooseRecord).compatibility_date
        : version.compatibility_date,
    ),
    compatibilityFlags: Array.isArray(version.compatibility_flags) ? (version.compatibility_flags as string[]) : [],
    trafficPercent: traffic,
  };
}

export function normalizeWorkerDeployment(
  deployment: LooseRecord,
  scriptName: string,
  account: { id: string; name: string },
): WorkerDeployment {
  const versions = Array.isArray(deployment.versions) ? (deployment.versions as LooseRecord[]) : [];
  return {
    id: String(deployment.id ?? ""),
    scriptName,
    accountId: account.id,
    accountName: account.name,
    createdOn: text(deployment.created_on),
    source: text(deployment.source),
    strategy: text(deployment.strategy),
    versions: versions.map((item) => ({
      versionId: String(item.version_id ?? item.id ?? ""),
      percentage: Number(item.percentage ?? 0),
    })),
  };
}

export function normalizeWorkerTailEvent(payload: LooseRecord, sessionId: string, index: number): DeploymentLogEntry[] {
  const logs = Array.isArray(payload.logs) ? (payload.logs as LooseRecord[]) : [];
  const exceptions = Array.isArray(payload.exceptions) ? (payload.exceptions as LooseRecord[]) : [];
  const event = (payload.event ?? {}) as LooseRecord;
  const request = (event.request ?? {}) as LooseRecord;
  const outcome = text(payload.outcome);
  const method = text(request.method);
  const url = text(request.url);
  const cpu = payload.cpuTime ?? payload.wallTime;
  const stamp = text(payload.eventTimestamp) ?? (typeof payload.eventTimestamp === "number" ? new Date(payload.eventTimestamp).toISOString() : undefined);
  const entries: DeploymentLogEntry[] = [];
  if (method || url || outcome) {
    entries.push({
      id: `${sessionId}-req-${index}`,
      timestamp: stamp,
      level: outcome && outcome !== "ok" ? "error" : "info",
      message: [method, url, outcome, cpu !== undefined ? `${String(cpu)}ms` : undefined].filter(Boolean).join(" "),
      source: "request",
    });
  }
  logs.forEach((log, logIndex) => {
    const message = Array.isArray(log.message) ? log.message.map(String).join(" ") : String(log.message ?? "");
    entries.push({
      id: `${sessionId}-log-${index}-${logIndex}`,
      timestamp: typeof log.timestamp === "number" ? new Date(log.timestamp).toISOString() : stamp,
      level: inferLogLevel(message, text(log.level)),
      message,
      source: "console",
    });
  });
  exceptions.forEach((exception, exceptionIndex) => {
    entries.push({
      id: `${sessionId}-ex-${index}-${exceptionIndex}`,
      timestamp: stamp,
      level: "error",
      message: text(exception.message) ?? JSON.stringify(exception),
      source: "exception",
    });
  });
  return entries;
}

export function normalizeZone(zone: LooseRecord, account: { id: string; name: string }): DnsZone {
  const plan = (zone.plan ?? {}) as LooseRecord;
  return {
    id: String(zone.id ?? ""),
    accountId: account.id,
    accountName: account.name,
    name: String(zone.name ?? ""),
    status: text(zone.status) ?? "unknown",
    planName: text(plan.name),
    nameServers: Array.isArray(zone.name_servers) ? (zone.name_servers as string[]) : [],
  };
}

export function normalizeDnsRecord(record: LooseRecord, zone: { id: string; name: string }): DnsRecord {
  const typeRaw = String(record.type ?? "A").toUpperCase();
  const type = DNS_TYPES.has(typeRaw as DnsRecordType) ? (typeRaw as DnsRecordType) : "TXT";
  const data = (record.data ?? {}) as Record<string, string | number | boolean | undefined>;
  return {
    id: String(record.id ?? ""),
    zoneId: zone.id,
    zoneName: zone.name,
    type,
    name: String(record.name ?? ""),
    content: String(record.content ?? ""),
    ttl: Number(record.ttl ?? 1),
    proxied: typeof record.proxied === "boolean" ? record.proxied : undefined,
    proxiable: typeof record.proxiable === "boolean" ? record.proxiable : undefined,
    priority: typeof record.priority === "number" ? record.priority : undefined,
    comment: text(record.comment),
    modifiedOn: text(record.modified_on),
    data,
  };
}

export function workerDeploymentAsUnified(
  deployment: WorkerDeployment,
  scriptName: string,
  account: { id: string; name: string },
): UnifiedDeployment {
  const primary = deployment.versions[0];
  return {
    id: deployment.id,
    provider: "cloudflare-workers",
    accountId: account.id,
    accountName: account.name,
    projectId: scriptName,
    projectName: scriptName,
    state: "ready",
    environment: "production",
    aliases: [],
    commitSha: primary?.versionId,
    commitMessage: deployment.versions.map((item) => `${item.versionId.slice(0, 8)} ${item.percentage}%`).join(", "),
    author: deployment.source,
    createdAt: deployment.createdOn ?? new Date().toISOString(),
  };
}
