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
  createdAt?: string;
}

export interface DnsZone {
  id: string;
  accountId: string;
  accountName: string;
  name: string;
  status: string;
  planName?: string;
  nameServers: string[];
}

export type DnsRecordType =
  | "A"
  | "AAAA"
  | "CNAME"
  | "TXT"
  | "MX"
  | "CAA"
  | "SRV"
  | "NS";

export interface DnsRecord {
  id: string;
  zoneId: string;
  zoneName: string;
  type: DnsRecordType;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  proxiable?: boolean;
  priority?: number;
  comment?: string;
  modifiedOn?: string;
  data?: Record<string, string | number | boolean | undefined>;
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

export type ActivityKind =
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
    userName?: string;
    userEmail?: string;
    userId?: string;
    teams: Array<{ id: string; name: string; slug: string }>;
    activeTeamId: string | null;
  };
  cloudflare: {
    connected: boolean;
    accounts: Array<{ id: string; name: string }>;
    activeAccountId: string | null;
  };
}

export interface AppPreferences {
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
  setupComplete: false,
};
