import type { CloudflareCapabilities } from "./oauth";

export type Provider = "vercel" | "cloudflare-pages" | "cloudflare-workers";

export type DeploymentState =
  | "queued"
  | "building"
  | "ready"
  | "failed"
  | "canceled"
  | "unknown";

export type DeploymentEnvironment =
  | "production"
  | "preview"
  | "development"
  | "unknown";

export type Screen =
  | "overview"
  | "deployments"
  | "projects"
  | "domains"
  | "dns"
  | "environments"
  | "activity"
  | "settings";

export type ThemePreference = "system" | "light" | "dark";
export type DensityPreference = "compact" | "comfortable";
export type TimeFormatPreference = "relative" | "absolute";

export interface UnifiedDeployment {
  id: string;
  provider: Provider;
  accountId: string;
  accountName: string;
  projectId: string;
  projectName: string;
  state: DeploymentState;
  environment: DeploymentEnvironment;
  url?: string;
  aliases: string[];
  branch?: string;
  commitSha?: string;
  commitMessage?: string;
  author?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface UnifiedProject {
  id: string;
  provider: Provider;
  accountId: string;
  accountName: string;
  name: string;
  framework?: string;
  productionBranch?: string;
  rootDirectory?: string;
  installCommand?: string;
  buildCommand?: string;
  outputDirectory?: string;
  repository?: string;
  repositoryUrl?: string;
  domains: string[];
  productionUrl?: string;
  latestDeploymentId?: string;
  latestDeploymentState?: DeploymentState;
  latestDeploymentAt?: string;
  updatedAt: string;
  dashboardUrl: string;
  paused?: boolean;
}

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "unknown";

export interface DeploymentLogEntry {
  id: string;
  timestamp?: string;
  level: LogLevel;
  message: string;
  source?: string;
  stage?: string;
  raw?: unknown;
}

export interface DomainVerificationRecord {
  type: DnsRecordType;
  name: string;
  value: string;
  reason?: string;
}

export interface UnifiedDomain {
  id: string;
  provider: Provider;
  accountId: string;
  accountName: string;
  projectId: string;
  projectName: string;
  name: string;
  status: string;
  verified?: boolean;
  certificateStatus?: string;
  verificationStatus?: string;
  apex?: boolean;
  redirectTo?: string;
  gitBranch?: string;
  customEnvironmentId?: string;
  createdAt?: string;
  verificationRecords: DomainVerificationRecord[];
}

export type CloudflareDnsRecordType =
  | "A"
  | "AAAA"
  | "CNAME"
  | "MX"
  | "NS"
  | "OPENPGPKEY"
  | "PTR"
  | "TXT"
  | "CAA"
  | "CERT"
  | "DNSKEY"
  | "DS"
  | "HTTPS"
  | "LOC"
  | "NAPTR"
  | "SMIMEA"
  | "SRV"
  | "SSHFP"
  | "SVCB"
  | "TLSA"
  | "URI";

export type VercelDnsRecordType =
  | "A"
  | "AAAA"
  | "ALIAS"
  | "CAA"
  | "CNAME"
  | "HTTPS"
  | "MX"
  | "NS"
  | "SRV"
  | "TXT";

export type SupportedDnsRecordType = CloudflareDnsRecordType | VercelDnsRecordType;

/**
 * Provider APIs occasionally add record types before the desktop app updates.
 * Preserve those rows as UNKNOWN + rawType instead of silently relabelling them
 * as TXT, which could make a subsequent edit destructive.
 */
export type DnsRecordType = SupportedDnsRecordType | "UNKNOWN";

export type DnsProvider = "cloudflare" | "vercel";

export interface DnsZone {
  id: string;
  provider: DnsProvider;
  accountId: string;
  accountName: string;
  name: string;
  status: string;
  planName?: string;
  nameServers: string[];
}

export interface DnsRecord {
  id: string;
  provider: DnsProvider;
  zoneId: string;
  zoneName: string;
  type: DnsRecordType;
  rawType?: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  proxiable?: boolean;
  priority?: number;
  comment?: string;
  tags: string[];
  modifiedOn?: string;
  data?: Record<string, string | number | boolean | undefined>;
  settings?: Record<string, string | number | boolean | undefined>;
}

export type ProjectSourceKind = "git" | "local" | "direct";

export type CreateResourceKind =
  | "vercel-project"
  | "pages-project"
  | "worker"
  | "deployment"
  | "domain"
  | "dns-record"
  | "environment";

export interface GitProjectSource {
  kind: "git";
  provider: "github" | "gitlab" | "bitbucket" | "azure-devops";
  repository: string;
  branch: string;
}

export interface LocalProjectSource {
  kind: "local" | "direct";
  sourceId: string;
}

export type DeploymentSource =
  | (GitProjectSource & { ref?: string; commitSha?: string })
  | LocalProjectSource;

export interface ProjectCreateInput {
  provider: Provider;
  accountId?: string;
  name: string;
  source: GitProjectSource | LocalProjectSource;
  productionBranch: string;
  framework?: string;
  rootDirectory?: string;
  installCommand?: string;
  buildCommand?: string;
  outputDirectory?: string;
  compatibilityDate?: string;
  compatibilityFlags?: string[];
}

export interface ProjectPatchInput {
  name?: string;
  productionBranch?: string;
  framework?: string;
  rootDirectory?: string;
  installCommand?: string;
  buildCommand?: string;
  outputDirectory?: string;
  buildCaching?: boolean;
  previewDeployments?: "all" | "none" | "custom";
  compatibilityDate?: string;
  compatibilityFlags?: string[];
  observability?: boolean;
}

export interface LocalSourceHandle {
  id: string;
  kind: "source" | "pages-output" | "worker-entry" | "worker-project" | "worker-bundle";
  name: string;
  fileCount: number;
  totalBytes: number;
  ignoredCount: number;
  expiresAt: string;
  detected?: {
    framework?: string;
    entrypoint?: string;
    outputDirectory?: string;
    repository?: string;
  };
  warnings: string[];
}

export interface OperationProgress {
  operationId: string;
  phase: "preparing" | "hashing" | "uploading" | "creating" | "verifying" | "complete" | "canceled" | "failed";
  label: string;
  completed: number;
  total: number;
  bytesCompleted?: number;
  bytesTotal?: number;
}

export interface OperationResult {
  operationId: string;
  provider: Provider | "cloudflare" | "vercel";
  resourceKind: "project" | "deployment" | "worker" | "dns" | "domain" | "environment";
  resourceId?: string;
  resourceName?: string;
  dashboardUrl?: string;
}

export interface WorkerSchedule {
  cron: string;
  createdOn?: string;
}

export type EnvVarType = "plain" | "encrypted" | "secret" | "sensitive" | "unknown";

export interface EnvironmentVariable {
  id: string;
  provider: Provider;
  accountId: string;
  projectId: string;
  projectName: string;
  key: string;
  type: EnvVarType;
  targets: string[];
  branch?: string;
  updatedAt?: string;
  valueMasked: boolean;
  value?: string;
}

export interface WorkerScript {
  id: string;
  accountId: string;
  accountName: string;
  name: string;
  modifiedOn?: string;
  compatibilityDate?: string;
  compatibilityFlags: string[];
  activeDeploymentId?: string;
  activeVersionId?: string;
  tailConsumers: string[];
  routes: string[];
  domains: string[];
  dashboardUrl: string;
}

export interface WorkerVersion {
  id: string;
  scriptName: string;
  accountId: string;
  message?: string;
  tag?: string;
  createdOn?: string;
  source?: string;
  compatibilityDate?: string;
  compatibilityFlags: string[];
  trafficPercent?: number;
}

export interface WorkerDeployment {
  id: string;
  scriptName: string;
  accountId: string;
  accountName: string;
  createdOn?: string;
  source?: string;
  strategy?: string;
  versions: Array<{
    versionId: string;
    percentage: number;
  }>;
}

export interface WorkerRoute {
  id: string;
  pattern: string;
  script: string;
  zoneId: string;
  zoneName?: string;
}

export type ProjectFocus =
  | { kind: "project"; provider: Provider; id: string }
  | { kind: "worker"; accountId: string; name: string };

export interface EnvironmentFocus {
  provider: "vercel" | "cloudflare-pages" | "cloudflare-workers";
  targetId: string;
}

export type ActivityKind =
  | "project-created"
  | "project-updated"
  | "project-paused"
  | "project-resumed"
  | "project-deleted"
  | "deployment-created"
  | "deployment-retried"
  | "deployment-rolled-back"
  | "deployment-canceled"
  | "deployment-promoted"
  | "deployment-deleted"
  | "deployment-redeployed"
  | "domain-added"
  | "domain-removed"
  | "dns-record-created"
  | "dns-record-updated"
  | "dns-record-deleted"
  | "env-variable-changed"
  | "env-variable-deleted"
  | "worker-version-deployed"
  | "worker-created"
  | "worker-updated"
  | "worker-deleted"
  | "worker-schedules-updated"
  | "worker-secret-changed"
  | "connection-updated";

export interface LocalActivityEntry {
  id: string;
  at: string;
  kind: ActivityKind;
  provider?: Provider | "cloudflare";
  title: string;
  detail?: string;
  projectName?: string;
  targetId?: string;
}

export interface ConnectionStatus {
  vercel: {
    connected: boolean;
    authKind?: "oauth" | "pat";
    grantedScopes?: string[];
    userName?: string;
    userEmail?: string;
    userId?: string;
    teams: Array<{ id: string; name: string; slug: string }>;
    activeTeamId: string | null;
  };
  cloudflare: {
    connected: boolean;
    authKind?: "oauth" | "pat";
    grantedScopes?: string[];
    capabilities: CloudflareCapabilities;
    accounts: Array<{ id: string; name: string }>;
    activeAccountId: string | null;
  };
  oauth: {
    vercel: boolean;
    cloudflare: boolean;
  };
}

export interface AppPreferences {
  schemaVersion: 2;
  theme: ThemePreference;
  density: DensityPreference;
  defaultScreen: Screen;
  timeFormat: TimeFormatPreference;
  showTray: boolean;
  startMinimized: boolean;
  launchAtLogin: boolean;
  showProviderIcons: boolean;
  fullCommitSha: boolean;
  refreshEnabled: boolean;
  refreshIntervalMs: 30000 | 60000 | 120000;
  activeRefreshIntervalMs: 5000 | 10000;
  notifyProductionSuccess: boolean;
  notifyProductionFailure: boolean;
  notifyPreviewFailure: boolean;
  notifyWorkerChanged: boolean;
  notifyRollback: boolean;
  vercelTeamId: string | null;
  cloudflareAccountId: string | null;
  sidebarCollapsed: boolean;
  defaultDeploymentTarget: "preview" | "production";
  localUploadIgnore: string[];
  setupComplete: boolean;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Paginated<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface DeploymentFilters {
  provider?: Provider | "all";
  accountId?: string | "all";
  projectId?: string;
  state?: DeploymentState | "all";
  environment?: DeploymentEnvironment | "all";
  branch?: string;
  query?: string;
}

export interface VercelDeploymentDetail extends UnifiedDeployment {
  creator?: string;
  source?: string;
  framework?: string;
  repository?: string;
  buildRegions?: string[];
  inspectorUrl?: string;
  dashboardUrl: string;
  metadata: unknown;
}

export interface PagesDeploymentDetail extends UnifiedDeployment {
  trigger?: string;
  latestStage?: string;
  stages: Array<{
    name: string;
    status: string;
    startedOn?: string;
    endedOn?: string;
    durationMs?: number;
  }>;
  buildConfig?: Record<string, string | undefined>;
  dashboardUrl: string;
  metadata: unknown;
}

export interface BuildStage {
  name: string;
  status: string;
  startedOn?: string;
  endedOn?: string;
  durationMs?: number;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  schemaVersion: 2,
  theme: "system",
  density: "compact",
  defaultScreen: "overview",
  timeFormat: "relative",
  showTray: true,
  startMinimized: false,
  launchAtLogin: false,
  showProviderIcons: true,
  fullCommitSha: false,
  refreshEnabled: true,
  refreshIntervalMs: 30000,
  activeRefreshIntervalMs: 5000,
  notifyProductionSuccess: true,
  notifyProductionFailure: true,
  notifyPreviewFailure: true,
  notifyWorkerChanged: true,
  notifyRollback: true,
  vercelTeamId: null,
  cloudflareAccountId: null,
  sidebarCollapsed: false,
  defaultDeploymentTarget: "preview",
  localUploadIgnore: [
    ".git",
    "node_modules",
    ".next",
    ".turbo",
    ".vercel",
    ".wrangler",
    ".DS_Store",
    ".env",
    ".env.local",
    ".env.*.local",
  ],
  setupComplete: false,
};
