import { contextBridge, ipcRenderer } from "electron";
import type { DeployDeckApi, HostEvent } from "@shared/api-contract";

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

const api: DeployDeckApi = {
  connections: {
    status: () => invoke("connections:status"),
    connectVercel: (token) => invoke("connections:connectVercel", token),
    connectCloudflare: (token) => invoke("connections:connectCloudflare", token),
    disconnect: (provider) => invoke("connections:disconnect", provider),
    setVercelTeam: (teamId) => invoke("connections:setVercelTeam", teamId),
    setCloudflareAccount: (accountId) => invoke("connections:setCloudflareAccount", accountId),
  },
  vercel: {
    listProjects: (query) => invoke("vercel:projects", query),
    getProject: (projectId) => invoke("vercel:project", projectId),
    listDeployments: (query) => invoke("vercel:deployments", query),
    getDeployment: (id) => invoke("vercel:deployment", id),
    getBuildLogs: (id) => invoke("vercel:buildLogs", id),
    getRuntimeLogs: (projectId, deploymentId) => invoke("vercel:runtimeLogs", projectId, deploymentId),
    cancelDeployment: (id) => invoke("vercel:cancelDeployment", id),
    redeploy: (id, target) => invoke("vercel:redeploy", id, target),
    promote: (id, projectId) => invoke("vercel:promote", id, projectId),
    deleteDeployment: (id) => invoke("vercel:deleteDeployment", id),
    listDomains: (projectId) => invoke("vercel:domains", projectId),
    addDomain: (projectId, name) => invoke("vercel:addDomain", projectId, name),
    removeDomain: (projectId, name) => invoke("vercel:removeDomain", projectId, name),
    verifyDomain: (projectId, name) => invoke("vercel:verifyDomain", projectId, name),
    listEnvVars: (projectId) => invoke("vercel:envVars", projectId),
    createEnvVar: (projectId, input) => invoke("vercel:createEnvVar", projectId, input),
    updateEnvVar: (projectId, envId, input) => invoke("vercel:updateEnvVar", projectId, envId, input),
    deleteEnvVar: (projectId, envId) => invoke("vercel:deleteEnvVar", projectId, envId),
    revealEnvVar: (projectId, envId) => invoke("vercel:revealEnvVar", projectId, envId),
  },
  cloudflare: {
    listPagesProjects: (accountId, query) => invoke("cloudflare:pagesProjects", accountId, query),
    getPagesProject: (accountId, projectName) => invoke("cloudflare:pagesProject", accountId, projectName),
    listPagesDeployments: (query) => invoke("cloudflare:pagesDeployments", query),
    getPagesDeployment: (accountId, projectName, deploymentId) =>
      invoke("cloudflare:pagesDeployment", accountId, projectName, deploymentId),
    getPagesLogs: (accountId, projectName, deploymentId) =>
      invoke("cloudflare:pagesLogs", accountId, projectName, deploymentId),
    retryPagesDeployment: (accountId, projectName, deploymentId) =>
      invoke("cloudflare:retryPagesDeployment", accountId, projectName, deploymentId),
    rollbackPagesDeployment: (accountId, projectName, deploymentId) =>
      invoke("cloudflare:rollbackPagesDeployment", accountId, projectName, deploymentId),
    deletePagesDeployment: (accountId, projectName, deploymentId) =>
      invoke("cloudflare:deletePagesDeployment", accountId, projectName, deploymentId),
    listPagesDomains: (accountId, projectName) => invoke("cloudflare:pagesDomains", accountId, projectName),
    addPagesDomain: (accountId, projectName, name) => invoke("cloudflare:addPagesDomain", accountId, projectName, name),
    removePagesDomain: (accountId, projectName, name) =>
      invoke("cloudflare:removePagesDomain", accountId, projectName, name),
    retryPagesDomain: (accountId, projectName, name) =>
      invoke("cloudflare:retryPagesDomain", accountId, projectName, name),
    listPagesEnv: (accountId, projectName, environment) =>
      invoke("cloudflare:pagesEnv", accountId, projectName, environment),
    upsertPagesEnv: (input) => invoke("cloudflare:upsertPagesEnv", input),
    deletePagesEnv: (accountId, projectName, environment, name) =>
      invoke("cloudflare:deletePagesEnv", accountId, projectName, environment, name),
    listWorkers: (accountId, query) => invoke("cloudflare:workers", accountId, query),
    getWorker: (accountId, scriptName) => invoke("cloudflare:worker", accountId, scriptName),
    listWorkerVersions: (accountId, scriptName) => invoke("cloudflare:workerVersions", accountId, scriptName),
    listWorkerDeployments: (accountId, scriptName) => invoke("cloudflare:workerDeployments", accountId, scriptName),
    deployWorkerVersion: (accountId, scriptName, versionId, percentage, previousVersionId) =>
      invoke("cloudflare:deployWorkerVersion", accountId, scriptName, versionId, percentage, previousVersionId),
    restoreWorkerDeployment: (accountId, scriptName, deploymentId) =>
      invoke("cloudflare:restoreWorkerDeployment", accountId, scriptName, deploymentId),
    listWorkerRoutes: (accountId, scriptName) => invoke("cloudflare:workerRoutes", accountId, scriptName),
    listWorkerDomains: (accountId, scriptName) => invoke("cloudflare:workerDomains", accountId, scriptName),
    attachWorkerDomain: (accountId, scriptName, hostname, zoneId) =>
      invoke("cloudflare:attachWorkerDomain", accountId, scriptName, hostname, zoneId),
    detachWorkerDomain: (accountId, domainId) => invoke("cloudflare:detachWorkerDomain", accountId, domainId),
    listWorkerVars: (accountId, scriptName) => invoke("cloudflare:workerVars", accountId, scriptName),
    upsertWorkerVar: (accountId, scriptName, name, value) =>
      invoke("cloudflare:upsertWorkerVar", accountId, scriptName, name, value),
    deleteWorkerVar: (accountId, scriptName, name) =>
      invoke("cloudflare:deleteWorkerVar", accountId, scriptName, name),
    listWorkerSecrets: (accountId, scriptName) => invoke("cloudflare:workerSecrets", accountId, scriptName),
    putWorkerSecret: (accountId, scriptName, name, value) =>
      invoke("cloudflare:putWorkerSecret", accountId, scriptName, name, value),
    deleteWorkerSecret: (accountId, scriptName, name) =>
      invoke("cloudflare:deleteWorkerSecret", accountId, scriptName, name),
    startWorkerTail: (accountId, scriptName) => invoke("cloudflare:startWorkerTail", accountId, scriptName),
    stopWorkerTail: (sessionId) => invoke("cloudflare:stopWorkerTail", sessionId),
    listZones: (accountId, query) => invoke("cloudflare:zones", accountId, query),
    listDnsRecords: (zoneId, query) => invoke("cloudflare:dnsRecords", zoneId, query),
    createDnsRecord: (input) => invoke("cloudflare:createDnsRecord", input),
    updateDnsRecord: (recordId, input) => invoke("cloudflare:updateDnsRecord", recordId, input),
    deleteDnsRecord: (zoneId, recordId) => invoke("cloudflare:deleteDnsRecord", zoneId, recordId),
  },
  prefs: {
    get: () => invoke("prefs:get"),
    set: (patch) => invoke("prefs:set", patch),
  },
  activity: {
    list: () => invoke("activity:list"),
    clear: () => invoke("activity:clear"),
  },
  window: {
    getBounds: () => invoke("window:getBounds"),
  },
  shell: {
    openHttps: (url) => invoke("shell:openHttps", url),
  },
  files: {
    saveText: (defaultName, contents) => invoke("files:saveText", defaultName, contents),
  },
  app: {
    getVersion: () => invoke("app:getVersion"),
  },
  on<T = unknown>(event: HostEvent, listener: (payload: T) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(args[0] as T);
    ipcRenderer.on(event, wrapped);
    return () => {
      ipcRenderer.removeListener(event, wrapped);
    };
  },
};

contextBridge.exposeInMainWorld("deployDeck", api);
