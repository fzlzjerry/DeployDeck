import type { AppError } from "./errors";
import type {
  AppPreferences,
  ConnectionStatus,
  DeploymentFilters,
  DeploymentLogEntry,
  DnsRecord,
  SupportedDnsRecordType,
  DnsZone,
  DeploymentSource,
  EnvironmentVariable,
  LocalSourceHandle,
  LocalActivityEntry,
  OperationProgress,
  OperationResult,
  PagesDeploymentDetail,
  Paginated,
  Screen,
  ThemePreference,
  UnifiedDeployment,
  UnifiedDomain,
  UnifiedProject,
  VercelDeploymentDetail,
  WindowBounds,
  WorkerDeployment,
  WorkerRoute,
  WorkerSchedule,
  WorkerScript,
  WorkerVersion,
  ProjectCreateInput,
  ProjectPatchInput,
} from "./models";
import type { DnsRecordWrite } from "./dns-records";

export type IpcChannel =
  | "connections:status"
  | "connections:connectVercel"
  | "connections:connectCloudflare"
  | "connections:startOAuth"
  | "connections:cancelOAuth"
  | "connections:disconnect"
  | "connections:setVercelTeam"
  | "connections:setCloudflareAccount"
  | "vercel:projects"
  | "vercel:project"
  | "vercel:createProject"
  | "vercel:updateProject"
  | "vercel:deleteProject"
  | "vercel:pauseProject"
  | "vercel:resumeProject"
  | "vercel:deployments"
  | "vercel:createDeployment"
  | "vercel:deployment"
  | "vercel:buildLogs"
  | "vercel:runtimeLogs"
  | "vercel:cancelDeployment"
  | "vercel:redeploy"
  | "vercel:promote"
  | "vercel:rollback"
  | "vercel:deleteDeployment"
  | "vercel:domains"
  | "vercel:addDomain"
  | "vercel:updateDomain"
  | "vercel:moveDomain"
  | "vercel:removeDomain"
  | "vercel:verifyDomain"
  | "vercel:envVars"
  | "vercel:createEnvVar"
  | "vercel:updateEnvVar"
  | "vercel:deleteEnvVar"
  | "vercel:revealEnvVar"
  | "vercel:dnsZones"
  | "vercel:dnsRecords"
  | "vercel:createDnsRecord"
  | "vercel:updateDnsRecord"
  | "vercel:deleteDnsRecord"
  | "cloudflare:accounts"
  | "cloudflare:pagesProjects"
  | "cloudflare:pagesProject"
  | "cloudflare:createPagesProject"
  | "cloudflare:updatePagesProject"
  | "cloudflare:deletePagesProject"
  | "cloudflare:purgePagesBuildCache"
  | "cloudflare:pagesDeployments"
  | "cloudflare:createPagesDeployment"
  | "cloudflare:pagesDeployment"
  | "cloudflare:pagesLogs"
  | "cloudflare:retryPagesDeployment"
  | "cloudflare:rollbackPagesDeployment"
  | "cloudflare:deletePagesDeployment"
  | "cloudflare:pagesDomains"
  | "cloudflare:addPagesDomain"
  | "cloudflare:removePagesDomain"
  | "cloudflare:retryPagesDomain"
  | "cloudflare:pagesEnv"
  | "cloudflare:upsertPagesEnv"
  | "cloudflare:deletePagesEnv"
  | "cloudflare:workers"
  | "cloudflare:worker"
  | "cloudflare:createWorker"
  | "cloudflare:updateWorker"
  | "cloudflare:uploadWorker"
  | "cloudflare:downloadWorker"
  | "cloudflare:deleteWorker"
  | "cloudflare:workerSchedules"
  | "cloudflare:updateWorkerSchedules"
  | "cloudflare:workerSubdomain"
  | "cloudflare:updateWorkerSubdomain"
  | "cloudflare:triggerWorkerBuild"
  | "cloudflare:workerVersions"
  | "cloudflare:workerDeployments"
  | "cloudflare:deployWorkerVersion"
  | "cloudflare:restoreWorkerDeployment"
  | "cloudflare:workerRoutes"
  | "cloudflare:createWorkerRoute"
  | "cloudflare:deleteWorkerRoute"
  | "cloudflare:workerDomains"
  | "cloudflare:attachWorkerDomain"
  | "cloudflare:detachWorkerDomain"
  | "cloudflare:workerVars"
  | "cloudflare:upsertWorkerVar"
  | "cloudflare:deleteWorkerVar"
  | "cloudflare:workerSecrets"
  | "cloudflare:putWorkerSecret"
  | "cloudflare:deleteWorkerSecret"
  | "cloudflare:startWorkerTail"
  | "cloudflare:stopWorkerTail"
  | "cloudflare:zones"
  | "cloudflare:dnsRecords"
  | "cloudflare:createDnsRecord"
  | "cloudflare:updateDnsRecord"
  | "cloudflare:deleteDnsRecord"
  | "cloudflare:batchDnsRecords"
  | "cloudflare:importDnsRecords"
  | "cloudflare:exportDnsRecords"
  | "prefs:get"
  | "prefs:set"
  | "activity:list"
  | "activity:clear"
  | "window:getBounds"
  | "shell:openHttps"
  | "files:saveText"
  | "files:openText"
  | "files:selectLocalSource"
  | "files:releaseLocalSource"
  | "operations:cancel"
  | "app:getVersion";

export type HostEvent =
  | "host:navigate"
  | "host:open-deployment"
  | "host:theme"
  | "host:power-resume"
  | "host:power-suspend"
  | "host:connection-changed"
  | "host:focus-search"
  | "host:refresh"
  | "host:refresh-all"
  | "host:open-command-palette"
  | "host:open-selected"
  | "host:worker-tail"
  | "host:operation-progress"
  | "host:tray-snapshot-needed";

export interface DeploymentListQuery extends DeploymentFilters {
  cursor?: string;
  limit?: number;
}

export interface EnvVarInput {
  key: string;
  value: string;
  type?: "plain" | "encrypted" | "secret" | "sensitive";
  targets: string[];
  branch?: string;
  comment?: string;
}

export interface PagesEnvInput {
  accountId: string;
  projectName: string;
  environment: "production" | "preview";
  name: string;
  value: string;
  secret?: boolean;
}

export interface DomainPatchInput {
  redirect?: string | null;
  redirectStatusCode?: 301 | 302 | 307 | 308 | null;
  gitBranch?: string | null;
  customEnvironmentId?: string | null;
}

export type DnsRecordInput = DnsRecordWrite;

export interface DnsBatchInput {
  provider: "cloudflare" | "vercel";
  zoneId: string;
  deletes?: string[];
  patches?: Array<{ id: string; input: DnsRecordInput }>;
  puts?: Array<{ id: string; input: DnsRecordInput }>;
  posts?: DnsRecordInput[];
}

export interface CreateDeploymentInput {
  projectId: string;
  accountId?: string;
  projectName?: string;
  source: DeploymentSource;
  target: "preview" | "production";
  force?: boolean;
}

export interface WorkerUploadInput {
  accountId: string;
  scriptName: string;
  sourceId: string;
  compatibilityDate?: string;
  compatibilityFlags?: string[];
  message?: string;
  deploy?: boolean;
}

export interface WorkerSubdomainState {
  enabled: boolean;
  previewsEnabled?: boolean;
}

export interface WorkerTailEvent {
  sessionId: string;
  entry: DeploymentLogEntry;
}

export interface DeployDeckApi {
  connections: {
    status(): Promise<ConnectionStatus>;
    connectVercel(token: string): Promise<ConnectionStatus>;
    connectCloudflare(token: string): Promise<ConnectionStatus>;
    startOAuth(provider: "vercel" | "cloudflare"): Promise<ConnectionStatus | null>;
    cancelOAuth(): Promise<void>;
    disconnect(provider: "vercel" | "cloudflare"): Promise<ConnectionStatus>;
    setVercelTeam(teamId: string | null): Promise<void>;
    setCloudflareAccount(accountId: string | null): Promise<void>;
  };
  vercel: {
    listProjects(query?: string): Promise<UnifiedProject[]>;
    getProject(projectId: string): Promise<UnifiedProject>;
    createProject(input: ProjectCreateInput): Promise<UnifiedProject>;
    updateProject(projectId: string, patch: ProjectPatchInput): Promise<UnifiedProject>;
    deleteProject(projectId: string): Promise<void>;
    pauseProject(projectId: string): Promise<void>;
    resumeProject(projectId: string): Promise<void>;
    listDeployments(query: DeploymentListQuery): Promise<Paginated<UnifiedDeployment>>;
    createDeployment(input: CreateDeploymentInput): Promise<OperationResult>;
    getDeployment(id: string): Promise<VercelDeploymentDetail>;
    getBuildLogs(id: string): Promise<DeploymentLogEntry[]>;
    getRuntimeLogs(projectId: string, deploymentId: string): Promise<DeploymentLogEntry[] | { unavailable: string }>;
    cancelDeployment(id: string): Promise<void>;
    redeploy(id: string, target?: "production" | "preview"): Promise<UnifiedDeployment>;
    promote(id: string, projectId: string): Promise<void>;
    rollback(id: string, projectId: string): Promise<void>;
    deleteDeployment(id: string): Promise<void>;
    listDomains(projectId: string): Promise<UnifiedDomain[]>;
    addDomain(projectId: string, name: string): Promise<UnifiedDomain>;
    updateDomain(projectId: string, name: string, patch: DomainPatchInput): Promise<UnifiedDomain>;
    moveDomain(projectId: string, name: string, targetProjectId: string): Promise<UnifiedDomain>;
    removeDomain(projectId: string, name: string): Promise<void>;
    verifyDomain(projectId: string, name: string): Promise<UnifiedDomain>;
    listEnvVars(projectId: string): Promise<EnvironmentVariable[]>;
    createEnvVar(projectId: string, input: EnvVarInput): Promise<void>;
    updateEnvVar(projectId: string, envId: string, input: EnvVarInput): Promise<void>;
    deleteEnvVar(projectId: string, envId: string): Promise<void>;
    revealEnvVar(projectId: string, envId: string): Promise<string>;
    listDnsZones(): Promise<DnsZone[]>;
    listDnsRecords(zoneId: string, query?: { search?: string; type?: SupportedDnsRecordType | "all"; page?: number }): Promise<Paginated<DnsRecord>>;
    createDnsRecord(input: DnsRecordInput): Promise<DnsRecord>;
    updateDnsRecord(recordId: string, input: DnsRecordInput): Promise<DnsRecord>;
    deleteDnsRecord(zoneId: string, recordId: string): Promise<void>;
  };
  cloudflare: {
    listPagesProjects(accountId?: string, query?: string): Promise<UnifiedProject[]>;
    getPagesProject(accountId: string, projectName: string): Promise<UnifiedProject>;
    createPagesProject(input: ProjectCreateInput): Promise<UnifiedProject>;
    updatePagesProject(accountId: string, projectName: string, patch: ProjectPatchInput): Promise<UnifiedProject>;
    deletePagesProject(accountId: string, projectName: string): Promise<void>;
    purgePagesBuildCache(accountId: string, projectName: string): Promise<void>;
    listPagesDeployments(query: DeploymentListQuery & { accountId?: string; projectName?: string }): Promise<Paginated<UnifiedDeployment>>;
    createPagesDeployment(input: CreateDeploymentInput): Promise<OperationResult>;
    getPagesDeployment(accountId: string, projectName: string, deploymentId: string): Promise<PagesDeploymentDetail>;
    getPagesLogs(accountId: string, projectName: string, deploymentId: string): Promise<DeploymentLogEntry[]>;
    retryPagesDeployment(accountId: string, projectName: string, deploymentId?: string): Promise<void>;
    rollbackPagesDeployment(accountId: string, projectName: string, deploymentId: string): Promise<void>;
    deletePagesDeployment(accountId: string, projectName: string, deploymentId: string): Promise<void>;
    listPagesDomains(accountId: string, projectName: string): Promise<UnifiedDomain[]>;
    addPagesDomain(accountId: string, projectName: string, name: string): Promise<void>;
    removePagesDomain(accountId: string, projectName: string, name: string): Promise<void>;
    retryPagesDomain(accountId: string, projectName: string, name: string): Promise<void>;
    listPagesEnv(accountId: string, projectName: string, environment: "production" | "preview"): Promise<EnvironmentVariable[]>;
    upsertPagesEnv(input: PagesEnvInput): Promise<void>;
    deletePagesEnv(accountId: string, projectName: string, environment: "production" | "preview", name: string): Promise<void>;
    listWorkers(accountId?: string, query?: string): Promise<WorkerScript[]>;
    getWorker(accountId: string, scriptName: string): Promise<WorkerScript>;
    createWorker(input: ProjectCreateInput): Promise<WorkerScript>;
    updateWorker(accountId: string, scriptName: string, patch: ProjectPatchInput): Promise<WorkerScript>;
    uploadWorker(input: WorkerUploadInput): Promise<OperationResult>;
    downloadWorker(accountId: string, scriptName: string): Promise<boolean>;
    deleteWorker(accountId: string, scriptName: string): Promise<void>;
    listWorkerSchedules(accountId: string, scriptName: string): Promise<WorkerSchedule[]>;
    updateWorkerSchedules(accountId: string, scriptName: string, schedules: WorkerSchedule[]): Promise<void>;
    getWorkerSubdomain(accountId: string, scriptName: string): Promise<WorkerSubdomainState>;
    updateWorkerSubdomain(accountId: string, scriptName: string, state: WorkerSubdomainState): Promise<void>;
    triggerWorkerBuild(accountId: string, scriptName: string, branch: string, commitSha?: string): Promise<OperationResult>;
    listWorkerVersions(accountId: string, scriptName: string): Promise<WorkerVersion[]>;
    listWorkerDeployments(accountId: string, scriptName: string): Promise<WorkerDeployment[]>;
    deployWorkerVersion(accountId: string, scriptName: string, versionId: string, percentage?: number, previousVersionId?: string): Promise<void>;
    restoreWorkerDeployment(accountId: string, scriptName: string, deploymentId: string): Promise<void>;
    listWorkerRoutes(accountId: string, scriptName?: string): Promise<WorkerRoute[]>;
    createWorkerRoute(accountId: string, scriptName: string, zoneId: string, pattern: string): Promise<void>;
    deleteWorkerRoute(zoneId: string, routeId: string): Promise<void>;
    listWorkerDomains(accountId: string, scriptName?: string): Promise<UnifiedDomain[]>;
    attachWorkerDomain(accountId: string, scriptName: string, hostname: string, zoneId: string): Promise<void>;
    detachWorkerDomain(accountId: string, domainId: string): Promise<void>;
    listWorkerVars(accountId: string, scriptName: string): Promise<EnvironmentVariable[]>;
    upsertWorkerVar(accountId: string, scriptName: string, name: string, value: string): Promise<void>;
    deleteWorkerVar(accountId: string, scriptName: string, name: string): Promise<void>;
    listWorkerSecrets(accountId: string, scriptName: string): Promise<EnvironmentVariable[]>;
    putWorkerSecret(accountId: string, scriptName: string, name: string, value: string): Promise<void>;
    deleteWorkerSecret(accountId: string, scriptName: string, name: string): Promise<void>;
    startWorkerTail(accountId: string, scriptName: string): Promise<{ sessionId: string }>;
    stopWorkerTail(sessionId: string): Promise<void>;
    listZones(accountId?: string, query?: string): Promise<DnsZone[]>;
    listDnsRecords(zoneId: string, query?: { search?: string; type?: SupportedDnsRecordType | "all"; proxied?: boolean; page?: number }): Promise<Paginated<DnsRecord>>;
    createDnsRecord(input: DnsRecordInput): Promise<DnsRecord>;
    updateDnsRecord(recordId: string, input: DnsRecordInput): Promise<DnsRecord>;
    deleteDnsRecord(zoneId: string, recordId: string): Promise<void>;
    batchDnsRecords(input: DnsBatchInput): Promise<void>;
    importDnsRecords(zoneId: string, bind: string): Promise<{ added: number; parsed: number }>;
    exportDnsRecords(zoneId: string): Promise<string>;
  };
  prefs: {
    get(): Promise<AppPreferences>;
    set(patch: Partial<AppPreferences>): Promise<AppPreferences>;
  };
  activity: {
    list(): Promise<LocalActivityEntry[]>;
    clear(): Promise<void>;
  };
  window: {
    getBounds(): Promise<WindowBounds | null>;
  };
  shell: {
    openHttps(url: string): Promise<void>;
  };
  files: {
    saveText(defaultName: string, contents: string): Promise<boolean>;
    openText(options?: { extensions?: string[]; title?: string }): Promise<{ name: string; contents: string } | null>;
    selectLocalSource(kind: LocalSourceHandle["kind"]): Promise<LocalSourceHandle | null>;
    releaseLocalSource(sourceId: string): Promise<void>;
  };
  operations: {
    cancel(operationId: string): Promise<void>;
  };
  app: {
    getVersion(): Promise<string>;
  };
  on<T = unknown>(event: HostEvent, listener: (payload: T) => void): () => void;
}

export interface HostNavigatePayload {
  screen: Screen;
}

export interface HostOpenDeploymentPayload {
  provider: UnifiedDeployment["provider"];
  id: string;
  projectId?: string;
  accountId?: string;
}

export interface HostThemePayload {
  theme: ThemePreference;
  resolved: "light" | "dark";
}

export type HostOperationProgressPayload = OperationProgress;

declare global {
  interface Window {
    deployDeck: DeployDeckApi;
  }
}

export type { AppError };
