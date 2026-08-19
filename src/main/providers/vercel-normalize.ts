import type {
  DeploymentLogEntry,
  EnvironmentVariable,
  EnvVarType,
  UnifiedDeployment,
  UnifiedDomain,
  UnifiedProject,
  VercelDeploymentDetail,
} from "@shared/models";
import { vercelVerificationRecords } from "@shared/domain-verification";
import { gitRepositoryUrl, httpsUrl, vercelDeploymentUrl, vercelProjectUrl } from "@shared/provider-types";
import { redactJson } from "@shared/redact";
import { inferLogLevel, vercelEnvironment, vercelState } from "@shared/status";

interface LooseRecord {
  [key: string]: unknown;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function vercelAccount(teamId: string | null, teamName: string, userName: string): { id: string; name: string } {
  return teamId ? { id: teamId, name: teamName } : { id: "personal", name: userName || "Personal" };
}

export function normalizeVercelProject(
  project: LooseRecord,
  account: { id: string; name: string },
  teamSlug?: string,
): UnifiedProject {
  const link = (project.link ?? {}) as LooseRecord;
  const repo =
    text(link.repo) ??
    (text(link.org) && text(link.repo) ? `${link.org as string}/${link.repo as string}` : undefined) ??
    text(link.repoSlug);
  const targets = (project.targets ?? {}) as LooseRecord;
  const production = (targets.production ?? {}) as LooseRecord;
  const domains = Array.isArray(project.alias)
    ? (project.alias as unknown[]).map((item) => (typeof item === "string" ? item : text((item as LooseRecord).domain))).filter((item): item is string => Boolean(item))
    : [];
  const latest = (project.latestDeployments as LooseRecord[] | undefined)?.[0];
  return {
    id: String(project.id ?? project.name),
    provider: "vercel",
    accountId: account.id,
    accountName: account.name,
    name: String(project.name ?? project.id),
    framework: text(project.framework),
    productionBranch: text(link.productionBranch) ?? text(project.defaultBranch),
    rootDirectory: text(project.rootDirectory),
    buildCommand: text((project.buildCommand as string | null) ?? undefined),
    outputDirectory: text((project.outputDirectory as string | null) ?? undefined),
    repository: repo,
    repositoryUrl: gitRepositoryUrl(repo ?? (link as { type?: string; repo?: string; org?: string })),
    domains,
    productionUrl: text(production.url) ? httpsUrl(String(production.url)) : undefined,
    latestDeploymentId: text(latest?.uid) ?? text(latest?.id) ?? text(production.id),
    latestDeploymentState: vercelState(text(latest?.readyState) ?? text(production.readyState)),
    latestDeploymentAt: latest?.created ? new Date(Number(latest.created)).toISOString() : undefined,
    updatedAt: project.updatedAt ? new Date(Number(project.updatedAt)).toISOString() : new Date().toISOString(),
    dashboardUrl: vercelProjectUrl(teamSlug, String(project.name ?? project.id)),
  };
}

export function normalizeVercelDeployment(
  deployment: LooseRecord,
  account: { id: string; name: string },
  projectName?: string,
): UnifiedDeployment {
  const meta = (deployment.meta ?? {}) as LooseRecord;
  const created = num(deployment.createdAt) ?? num(deployment.created);
  const building = num(deployment.buildingAt);
  const ready = num(deployment.ready) ?? num(deployment.readyAt);
  const aliases = Array.isArray(deployment.alias)
    ? (deployment.alias as unknown[]).filter((item): item is string => typeof item === "string")
    : [];
  return {
    id: String(deployment.uid ?? deployment.id),
    provider: "vercel",
    accountId: account.id,
    accountName: account.name,
    projectId: String(deployment.projectId ?? deployment.name ?? ""),
    projectName: projectName ?? String(deployment.name ?? deployment.projectId ?? ""),
    state: vercelState(text(deployment.readyState) ?? text(deployment.state)),
    environment: vercelEnvironment(text(deployment.target)),
    url: text(deployment.url) ? httpsUrl(String(deployment.url)) : undefined,
    aliases: aliases.map((alias) => httpsUrl(alias)),
    branch: text(meta.githubCommitRef) ?? text(meta.gitlabCommitRef) ?? text(meta.bitbucketCommitRef) ?? text(deployment.source),
    commitSha: text(meta.githubCommitSha) ?? text(meta.gitlabCommitSha) ?? text(meta.bitbucketCommitSha),
    commitMessage: text(meta.githubCommitMessage) ?? text(meta.gitlabCommitMessage) ?? text(meta.bitbucketCommitMessage),
    author:
      text(meta.githubCommitAuthorName) ??
      text(meta.gitlabCommitAuthorName) ??
      text((deployment.creator as LooseRecord | undefined)?.username),
    createdAt: created ? new Date(created).toISOString() : new Date().toISOString(),
    startedAt: building ? new Date(building).toISOString() : undefined,
    completedAt: ready ? new Date(ready).toISOString() : undefined,
    durationMs: created && ready ? Math.max(0, ready - created) : undefined,
  };
}

export function normalizeVercelDeploymentDetail(
  deployment: LooseRecord,
  account: { id: string; name: string },
  teamSlug: string | undefined,
  aliases: string[],
): VercelDeploymentDetail {
  const base = normalizeVercelDeployment(deployment, account);
  const project = (deployment.project ?? {}) as LooseRecord;
  const gitSource = (deployment.gitSource ?? {}) as LooseRecord;
  const creator = (deployment.creator ?? {}) as LooseRecord;
  const regions = Array.isArray(deployment.regions)
    ? (deployment.regions as unknown[]).filter((item): item is string => typeof item === "string")
    : undefined;
  return {
    ...base,
    aliases: aliases.length > 0 ? aliases.map(httpsUrl) : base.aliases,
    creator: text(creator.username) ?? text(creator.email),
    source: text(deployment.source),
    framework: text(project.framework),
    repository: gitRepositoryUrl({
      owner: text(gitSource.org) ?? text(gitSource.owner),
      name: text(gitSource.repo),
      slug: text(gitSource.repo) && (text(gitSource.org) || text(gitSource.owner))
        ? `${text(gitSource.org) ?? text(gitSource.owner)}/${text(gitSource.repo)}`
        : undefined,
    }),
    buildRegions: regions,
    inspectorUrl: text(deployment.inspectorUrl) ? httpsUrl(String(deployment.inspectorUrl)) : undefined,
    dashboardUrl: vercelDeploymentUrl(teamSlug, base.projectName, base.id),
    metadata: redactJson(deployment),
  };
}

export function normalizeVercelDomain(
  domain: LooseRecord,
  project: { id: string; name: string },
  account: { id: string; name: string },
): UnifiedDomain {
  return {
    id: `${project.id}:${String(domain.name ?? domain.apexName ?? "")}`,
    provider: "vercel",
    accountId: account.id,
    accountName: account.name,
    projectId: project.id,
    projectName: project.name,
    name: String(domain.name ?? ""),
    status: domain.verified ? "verified" : "pending",
    verified: Boolean(domain.verified),
    verificationStatus: Array.isArray(domain.verification)
      ? (domain.verification as LooseRecord[]).map((item) => text(item.type) ?? text(item.reason)).filter(Boolean).join(", ")
      : undefined,
    verificationRecords: vercelVerificationRecords(domain.verification),
    apex: Boolean(domain.apexName && domain.apexName === domain.name),
    redirectTo: text(domain.redirect),
    createdAt: domain.createdAt ? new Date(Number(domain.createdAt)).toISOString() : undefined,
  };
}

export function normalizeVercelEnv(env: LooseRecord, project: { id: string; name: string }, accountId: string): EnvironmentVariable {
  const type = (text(env.type) ?? "encrypted") as EnvVarType;
  const targets = Array.isArray(env.target) ? (env.target as string[]) : text(env.target) ? [String(env.target)] : [];
  return {
    id: String(env.id ?? env.key),
    provider: "vercel",
    accountId,
    projectId: project.id,
    projectName: project.name,
    key: String(env.key ?? ""),
    type: ["plain", "encrypted", "secret", "sensitive"].includes(type) ? type : "unknown",
    targets,
    branch: text(env.gitBranch),
    updatedAt: env.updatedAt ? new Date(Number(env.updatedAt)).toISOString() : undefined,
    valueMasked: true,
    value: undefined,
  };
}

export function normalizeVercelBuildEvent(event: LooseRecord, index: number): DeploymentLogEntry {
  const date = num(event.created) ?? num(event.date) ?? num(event.timestamp);
  const textValue =
    text(event.text) ??
    text(event.payload && typeof event.payload === "object" ? (event.payload as LooseRecord).text : undefined) ??
    text(event.message) ??
    JSON.stringify(event.info ?? event);
  return {
    id: text(event.id) ?? `event-${index}-${date ?? index}`,
    timestamp: date ? new Date(date).toISOString() : undefined,
    level: inferLogLevel(textValue, text(event.type) ?? text(event.level)),
    message: textValue,
    source: text(event.type) ?? text(event.serial),
    stage: text(event.name),
  };
}

export function normalizeVercelRuntimeLog(entry: LooseRecord, index: number): DeploymentLogEntry {
  const timestamp = num(entry.timestampInMs);
  const path = text(entry.requestPath);
  const method = text(entry.requestMethod);
  const prefix = method && path ? `${method} ${path} ` : "";
  return {
    id: text(entry.rowId) ?? `runtime-${index}`,
    timestamp: timestamp ? new Date(timestamp).toISOString() : undefined,
    level: inferLogLevel(text(entry.message) ?? "", text(entry.level)),
    message: `${prefix}${text(entry.message) ?? ""}`.trim(),
    source: text(entry.source),
  };
}
