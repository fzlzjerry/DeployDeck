import { BrowserWindow, app, dialog, ipcMain, shell } from "electron";
import { DeployDeckError, toAppError } from "@shared/errors";
import type { AppPreferences, ConnectionStatus } from "@shared/models";
import { addActivity, clearActivity, listActivity } from "./activity";
import { cloudflareCapabilities, tokensToCredential, type OAuthProvider } from "@shared/oauth";
import { clearToken, hasToken, readCredential, saveCredential, saveToken } from "./credentials";
import { isOAuthConfigured } from "./oauth/config";
import { OAuthCancelledError, cancelOAuthSession, startOAuthSession } from "./oauth/session";
import { revokeOAuthCredential } from "./oauth/tokens";
import {
  addPagesDomain,
  attachWorkerDomain,
  batchDnsRecords,
  connectCloudflare,
  createPagesDeployment,
  createPagesProject,
  createDnsRecord,
  createWorker,
  createWorkerRoute,
  deleteDnsRecord,
  deletePagesDeployment,
  deletePagesEnv,
  deletePagesProject,
  deleteWorker,
  deleteWorkerRoute,
  deleteWorkerSecret,
  deleteWorkerVar,
  deployWorkerVersion,
  detachWorkerDomain,
  downloadWorker,
  exportDnsRecords,
  getPagesDeployment,
  getPagesLogs,
  getPagesProject,
  getWorker,
  getWorkerSubdomain,
  importDnsRecords,
  listCloudflareAccounts,
  listDnsRecords,
  listPagesDeployments,
  listPagesDomains,
  listPagesEnv,
  listPagesProjects,
  listWorkerDeployments,
  listWorkerDomains,
  listWorkerRoutes,
  listWorkerSchedules,
  listWorkerSecrets,
  listWorkerVars,
  listWorkerVersions,
  listWorkers,
  listZones,
  putWorkerSecret,
  purgePagesBuildCache,
  removePagesDomain,
  resetCloudflareClient,
  restoreWorkerDeployment,
  retryPagesDeployment,
  retryPagesDomain,
  rollbackPagesDeployment,
  setCloudflareWindow,
  startWorkerTail,
  stopWorkerTail,
  triggerWorkerBuild,
  updateDnsRecord,
  updatePagesProject,
  updateWorker,
  updateWorkerSchedules,
  updateWorkerSubdomain,
  uploadWorker,
  upsertPagesEnv,
  upsertWorkerVar,
} from "./providers/cloudflare-client";
import {
  addVercelDomain,
  cancelVercelDeployment,
  connectVercel,
  createVercelDeployment,
  createVercelDnsRecord,
  createVercelEnvVar,
  createVercelProject,
  deleteVercelDnsRecord,
  deleteVercelDeployment,
  deleteVercelEnvVar,
  deleteVercelProject,
  getVercelBuildLogs,
  getVercelDeployment,
  getVercelProject,
  getVercelRuntimeLogs,
  listVercelDeployments,
  listVercelDnsRecords,
  listVercelDnsZones,
  listVercelDomains,
  listVercelEnvVars,
  listVercelProjects,
  loadVercelScope,
  promoteVercelDeployment,
  moveVercelDomain,
  pauseVercelProject,
  redeployVercelDeployment,
  rollbackVercelDeployment,
  removeVercelDomain,
  resetVercelClient,
  resumeVercelProject,
  revealVercelEnvVar,
  updateVercelEnvVar,
  updateVercelDomain,
  updateVercelDnsRecord,
  updateVercelProject,
  verifyVercelDomain,
} from "./providers/vercel-client";
import { releaseLocalSource, selectLocalSource } from "./local-sources";
import { cancelOperation } from "./operations";
import { getPreferences, getWindowBounds, setPreferences } from "./preferences";
import { sendToRenderer } from "./window";

const CONNECTION_CHECK_TIMEOUT_MS = 4_000;

function handle(channel: string, fn: (...args: unknown[]) => Promise<unknown>): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof DeployDeckError) throw error;
      throw new DeployDeckError(toAppError(error));
    }
  });
}

async function connectionStatus(): Promise<ConnectionStatus> {
  const prefs = await getPreferences();
  const [vercelCredential, cloudflareCredential] = await Promise.all([
    readCredential("vercel"),
    readCredential("cloudflare"),
  ]);
  const vercelConnected = Boolean(vercelCredential);
  const cloudflareConnected = Boolean(cloudflareCredential);
  const status: ConnectionStatus = {
    vercel: {
      connected: vercelConnected,
      authKind: vercelCredential?.kind,
      grantedScopes: vercelCredential?.scopes,
      teams: [],
      activeTeamId: prefs.vercelTeamId,
    },
    cloudflare: {
      connected: cloudflareConnected,
      authKind: cloudflareCredential?.kind,
      grantedScopes: cloudflareCredential?.scopes,
      capabilities: cloudflareCapabilities(cloudflareCredential),
      accounts: [],
      activeAccountId: prefs.cloudflareAccountId,
    },
    oauth: {
      vercel: isOAuthConfigured("vercel"),
      cloudflare: isOAuthConfigured("cloudflare"),
    },
  };
  await Promise.all([
    vercelConnected
      ? withTimeout(loadVercelScope(), CONNECTION_CHECK_TIMEOUT_MS)
          .then((scope) => {
            status.vercel.userName = scope.userName;
            status.vercel.userEmail = scope.userEmail;
            status.vercel.userId = scope.userId;
            status.vercel.teams = scope.teams;
            status.vercel.activeTeamId = prefs.vercelTeamId;
          })
          .catch(async () => {
            // A terminal refresh error clears the credential. Transient
            // provider failures keep the saved connection so an offline launch
            // does not sign the user out.
            status.vercel.connected = await hasToken("vercel");
          })
      : Promise.resolve(),
    cloudflareConnected
      ? withTimeout(listCloudflareAccounts(), CONNECTION_CHECK_TIMEOUT_MS)
          .then((accounts) => {
            status.cloudflare.accounts = accounts;
          })
          .catch(async () => {
            status.cloudflare.connected = await hasToken("cloudflare");
          })
      : Promise.resolve(),
  ]);
  return status;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Provider connection check timed out.")), timeoutMs);
    timer.unref();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function asOAuthProvider(value: unknown): OAuthProvider {
  if (value === "vercel" || value === "cloudflare") return value;
  throw new Error("Unknown provider.");
}

async function finishOAuthConnect(provider: OAuthProvider, accessToken: string): Promise<void> {
  if (provider === "vercel") {
    const vercel = await connectVercel(accessToken);
    await addActivity({
      kind: "connection-updated",
      provider: "vercel",
      title: "Connected Vercel",
      detail: vercel.userName,
    });
    return;
  }
  const accounts = await connectCloudflare(accessToken);
  await addActivity({
    kind: "connection-updated",
    provider: "cloudflare",
    title: "Connected Cloudflare",
    detail: `${accounts.length} accounts`,
  });
}

export function registerIpc(window: BrowserWindow): void {
  setCloudflareWindow(window);

  handle("connections:status", () => connectionStatus());
  handle("connections:connectVercel", async (token) => {
    const vercel = await connectVercel(String(token));
    await saveToken("vercel", String(token));
    await addActivity({
      kind: "connection-updated",
      provider: "vercel",
      title: "Connected Vercel",
      detail: vercel.userName,
    });
    sendToRenderer("host:connection-changed");
    return connectionStatus();
  });
  handle("connections:connectCloudflare", async (token) => {
    const accounts = await connectCloudflare(String(token));
    await saveToken("cloudflare", String(token));
    await addActivity({
      kind: "connection-updated",
      provider: "cloudflare",
      title: "Connected Cloudflare",
      detail: `${accounts.length} accounts`,
    });
    sendToRenderer("host:connection-changed");
    return connectionStatus();
  });
  handle("connections:startOAuth", async (provider) => {
    const id = asOAuthProvider(provider);
    try {
      const tokens = await startOAuthSession(id);
      await finishOAuthConnect(id, tokens.accessToken);
      await saveCredential(id, tokensToCredential(tokens));
    } catch (error) {
      if (id === "vercel") resetVercelClient();
      else resetCloudflareClient();
      if (error instanceof OAuthCancelledError) {
        return null;
      }
      const message = error instanceof Error ? error.message : "Sign-in failed.";
      if (/denied|permission|forbidden|unauthorized|not authenticated|scope/i.test(message)) {
        throw new Error(
          `${message} If API access was not granted, paste a token instead.`,
        );
      }
      throw error;
    }
    sendToRenderer("host:connection-changed");
    return connectionStatus();
  });
  handle("connections:cancelOAuth", async () => {
    cancelOAuthSession();
  });
  handle("connections:disconnect", async (provider) => {
    const id = asOAuthProvider(provider);
    cancelOAuthSession();
    const credential = await readCredential(id);
    if (id === "vercel") {
      resetVercelClient();
      await clearToken("vercel");
    } else {
      resetCloudflareClient();
      await clearToken("cloudflare");
    }
    if (credential?.kind === "oauth") {
      await revokeOAuthCredential(id, credential);
    }
    await addActivity({
      kind: "connection-updated",
      provider: id,
      title: id === "vercel" ? "Disconnected Vercel" : "Disconnected Cloudflare",
    });
    sendToRenderer("host:connection-changed");
    return connectionStatus();
  });
  handle("connections:setVercelTeam", async (teamId) => {
    await setPreferences({ vercelTeamId: (teamId as string | null) ?? null });
    sendToRenderer("host:connection-changed");
  });
  handle("connections:setCloudflareAccount", async (accountId) => {
    await setPreferences({ cloudflareAccountId: (accountId as string | null) ?? null });
    sendToRenderer("host:connection-changed");
  });

  handle("vercel:projects", (query) => listVercelProjects(query as string | undefined));
  handle("vercel:project", (projectId) => getVercelProject(String(projectId)));
  handle("vercel:createProject", async (input) => {
    const project = await createVercelProject(input as never);
    await addActivity({ kind: "project-created", provider: "vercel", title: `Created project ${project.name}`, projectName: project.name, targetId: project.id });
    return project;
  });
  handle("vercel:updateProject", async (projectId, patch) => {
    const project = await updateVercelProject(String(projectId), patch as never);
    await addActivity({ kind: "project-updated", provider: "vercel", title: `Updated project ${project.name}`, projectName: project.name, targetId: project.id });
    return project;
  });
  handle("vercel:deleteProject", async (projectId) => {
    await deleteVercelProject(String(projectId));
    await addActivity({ kind: "project-deleted", provider: "vercel", title: "Deleted Vercel project", targetId: String(projectId) });
  });
  handle("vercel:pauseProject", async (projectId) => {
    await pauseVercelProject(String(projectId));
    await addActivity({ kind: "project-paused", provider: "vercel", title: "Paused Vercel project", targetId: String(projectId) });
  });
  handle("vercel:resumeProject", async (projectId) => {
    await resumeVercelProject(String(projectId));
    await addActivity({ kind: "project-resumed", provider: "vercel", title: "Resumed Vercel project", targetId: String(projectId) });
  });
  handle("vercel:deployments", (query) => listVercelDeployments(query as never));
  handle("vercel:createDeployment", async (input) => {
    const result = await createVercelDeployment(input as never);
    await addActivity({ kind: "deployment-created", provider: "vercel", title: `Created deployment for ${result.resourceName ?? "project"}`, projectName: result.resourceName, targetId: result.resourceId });
    return result;
  });
  handle("vercel:deployment", (id) => getVercelDeployment(String(id)));
  handle("vercel:buildLogs", (id) => getVercelBuildLogs(String(id)));
  handle("vercel:runtimeLogs", (projectId, deploymentId) =>
    getVercelRuntimeLogs(String(projectId), String(deploymentId)),
  );
  handle("vercel:cancelDeployment", async (id) => {
    await cancelVercelDeployment(String(id));
    await addActivity({ kind: "deployment-canceled", provider: "vercel", title: "Canceled Vercel deployment", targetId: String(id) });
  });
  handle("vercel:redeploy", async (id, target) => {
    const created = await redeployVercelDeployment(String(id), target as "production" | "preview" | undefined);
    await addActivity({
      kind: "deployment-redeployed",
      provider: "vercel",
      title: "Redeployed Vercel deployment",
      projectName: created.projectName,
      targetId: created.id,
    });
    return created;
  });
  handle("vercel:promote", async (id, projectId) => {
    await promoteVercelDeployment(String(id), String(projectId));
    await addActivity({ kind: "deployment-promoted", provider: "vercel", title: "Promoted deployment to production", targetId: String(id) });
  });
  handle("vercel:rollback", async (id, projectId) => {
    await rollbackVercelDeployment(String(id), String(projectId));
    await addActivity({
      kind: "deployment-rolled-back",
      provider: "vercel",
      title: "Rolled back Vercel production",
      targetId: String(id),
    });
  });
  handle("vercel:deleteDeployment", async (id) => {
    await deleteVercelDeployment(String(id));
    await addActivity({ kind: "deployment-deleted", provider: "vercel", title: "Deleted Vercel deployment", targetId: String(id) });
  });
  handle("vercel:domains", (projectId) => listVercelDomains(String(projectId)));
  handle("vercel:addDomain", async (projectId, name) => {
    const domain = await addVercelDomain(String(projectId), String(name));
    await addActivity({ kind: "domain-added", provider: "vercel", title: `Added ${name}`, projectName: String(projectId) });
    return domain;
  });
  handle("vercel:updateDomain", async (projectId, name, patch) => {
    const domain = await updateVercelDomain(String(projectId), String(name), patch as never);
    await addActivity({ kind: "domain-added", provider: "vercel", title: `Updated ${name}`, projectName: String(projectId) });
    return domain;
  });
  handle("vercel:moveDomain", async (projectId, name, targetProjectId) => {
    const domain = await moveVercelDomain(String(projectId), String(name), String(targetProjectId));
    await addActivity({ kind: "domain-added", provider: "vercel", title: `Moved ${name}`, projectName: String(targetProjectId) });
    return domain;
  });
  handle("vercel:removeDomain", async (projectId, name) => {
    await removeVercelDomain(String(projectId), String(name));
    await addActivity({ kind: "domain-removed", provider: "vercel", title: `Removed ${name}`, projectName: String(projectId) });
  });
  handle("vercel:verifyDomain", (projectId, name) => verifyVercelDomain(String(projectId), String(name)));
  handle("vercel:envVars", (projectId) => listVercelEnvVars(String(projectId)));
  handle("vercel:createEnvVar", async (projectId, input) => {
    await createVercelEnvVar(String(projectId), input as never);
    await addActivity({ kind: "env-variable-changed", provider: "vercel", title: "Created environment variable", projectName: String(projectId), targetId: String(projectId) });
  });
  handle("vercel:updateEnvVar", async (projectId, envId, input) => {
    await updateVercelEnvVar(String(projectId), String(envId), input as never);
    await addActivity({ kind: "env-variable-changed", provider: "vercel", title: "Updated environment variable", projectName: String(projectId), targetId: String(projectId) });
  });
  handle("vercel:deleteEnvVar", async (projectId, envId) => {
    await deleteVercelEnvVar(String(projectId), String(envId));
    await addActivity({ kind: "env-variable-deleted", provider: "vercel", title: "Deleted environment variable", projectName: String(projectId), targetId: String(projectId) });
  });
  handle("vercel:revealEnvVar", (projectId, envId) => revealVercelEnvVar(String(projectId), String(envId)));
  handle("vercel:dnsZones", () => listVercelDnsZones());
  handle("vercel:dnsRecords", (zoneId, query) => listVercelDnsRecords(String(zoneId), query as never));
  handle("vercel:createDnsRecord", async (input) => {
    const record = await createVercelDnsRecord(input as never);
    await addActivity({ kind: "dns-record-created", provider: "vercel", title: `Created ${record.type} ${record.name}`, targetId: record.zoneId });
    return record;
  });
  handle("vercel:updateDnsRecord", async (recordId, input) => {
    const record = await updateVercelDnsRecord(String(recordId), input as never);
    await addActivity({ kind: "dns-record-updated", provider: "vercel", title: `Updated ${record.type} ${record.name}`, targetId: record.zoneId });
    return record;
  });
  handle("vercel:deleteDnsRecord", async (zoneId, recordId) => {
    await deleteVercelDnsRecord(String(zoneId), String(recordId));
    await addActivity({ kind: "dns-record-deleted", provider: "vercel", title: "Deleted Vercel DNS record", targetId: String(zoneId) });
  });

  handle("cloudflare:accounts", () => listCloudflareAccounts());
  handle("cloudflare:pagesProjects", (accountId, query) =>
    listPagesProjects(accountId as string | undefined, query as string | undefined),
  );
  handle("cloudflare:pagesProject", (accountId, projectName) => getPagesProject(String(accountId), String(projectName)));
  handle("cloudflare:createPagesProject", async (input) => {
    const project = await createPagesProject(input as never);
    await addActivity({ kind: "project-created", provider: "cloudflare-pages", title: `Created Pages project ${project.name}`, projectName: project.name, targetId: project.id });
    return project;
  });
  handle("cloudflare:updatePagesProject", async (accountId, projectName, patch) => {
    const project = await updatePagesProject(String(accountId), String(projectName), patch as never);
    await addActivity({ kind: "project-updated", provider: "cloudflare-pages", title: `Updated Pages project ${project.name}`, projectName: project.name, targetId: project.id });
    return project;
  });
  handle("cloudflare:deletePagesProject", async (accountId, projectName) => {
    await deletePagesProject(String(accountId), String(projectName));
    await addActivity({ kind: "project-deleted", provider: "cloudflare-pages", title: `Deleted Pages project ${projectName}`, projectName: String(projectName) });
  });
  handle("cloudflare:purgePagesBuildCache", async (accountId, projectName) => {
    await purgePagesBuildCache(String(accountId), String(projectName));
    await addActivity({ kind: "project-updated", provider: "cloudflare-pages", title: `Purged build cache for ${projectName}`, projectName: String(projectName) });
  });
  handle("cloudflare:pagesDeployments", (query) => listPagesDeployments(query as never));
  handle("cloudflare:createPagesDeployment", async (input) => {
    const result = await createPagesDeployment(input as never);
    await addActivity({ kind: "deployment-created", provider: "cloudflare-pages", title: `Created Pages deployment for ${result.resourceName ?? "project"}`, projectName: result.resourceName, targetId: result.resourceId });
    return result;
  });
  handle("cloudflare:pagesDeployment", (accountId, projectName, deploymentId) =>
    getPagesDeployment(String(accountId), String(projectName), String(deploymentId)),
  );
  handle("cloudflare:pagesLogs", (accountId, projectName, deploymentId) =>
    getPagesLogs(String(accountId), String(projectName), String(deploymentId)),
  );
  handle("cloudflare:retryPagesDeployment", async (accountId, projectName, deploymentId) => {
    await retryPagesDeployment(String(accountId), String(projectName), String(deploymentId));
    await addActivity({
      kind: "deployment-retried",
      provider: "cloudflare-pages",
      title: "Retried Pages deployment",
      projectName: String(projectName),
    });
  });
  handle("cloudflare:rollbackPagesDeployment", async (accountId, projectName, deploymentId) => {
    await rollbackPagesDeployment(String(accountId), String(projectName), String(deploymentId));
    await addActivity({
      kind: "deployment-rolled-back",
      provider: "cloudflare-pages",
      title: "Rolled back Pages deployment",
      projectName: String(projectName),
    });
  });
  handle("cloudflare:deletePagesDeployment", async (accountId, projectName, deploymentId) => {
    await deletePagesDeployment(String(accountId), String(projectName), String(deploymentId));
    await addActivity({
      kind: "deployment-deleted",
      provider: "cloudflare-pages",
      title: "Deleted Pages deployment",
      projectName: String(projectName),
    });
  });
  handle("cloudflare:pagesDomains", (accountId, projectName) => listPagesDomains(String(accountId), String(projectName)));
  handle("cloudflare:addPagesDomain", async (accountId, projectName, name) => {
    await addPagesDomain(String(accountId), String(projectName), String(name));
    await addActivity({ kind: "domain-added", provider: "cloudflare-pages", title: `Added ${name}`, projectName: String(projectName) });
  });
  handle("cloudflare:removePagesDomain", async (accountId, projectName, name) => {
    await removePagesDomain(String(accountId), String(projectName), String(name));
    await addActivity({ kind: "domain-removed", provider: "cloudflare-pages", title: `Removed ${name}`, projectName: String(projectName) });
  });
  handle("cloudflare:retryPagesDomain", (accountId, projectName, name) =>
    retryPagesDomain(String(accountId), String(projectName), String(name)),
  );
  handle("cloudflare:pagesEnv", (accountId, projectName, environment) =>
    listPagesEnv(String(accountId), String(projectName), environment as "production" | "preview"),
  );
  handle("cloudflare:upsertPagesEnv", async (input) => {
    await upsertPagesEnv(input as never);
    await addActivity({
      kind: "env-variable-changed",
      provider: "cloudflare-pages",
      title: "Updated Pages variable",
      targetId: `${(input as { accountId?: string; projectName?: string }).accountId}::${(input as { projectName?: string }).projectName}`,
    });
  });
  handle("cloudflare:deletePagesEnv", async (accountId, projectName, environment, name) => {
    await deletePagesEnv(String(accountId), String(projectName), environment as "production" | "preview", String(name));
    await addActivity({ kind: "env-variable-deleted", provider: "cloudflare-pages", title: `Deleted ${name}` });
  });
  handle("cloudflare:workers", (accountId, query) => listWorkers(accountId as string | undefined, query as string | undefined));
  handle("cloudflare:worker", (accountId, scriptName) => getWorker(String(accountId), String(scriptName)));
  handle("cloudflare:createWorker", async (input) => {
    const worker = await createWorker(input as never);
    await addActivity({ kind: "worker-created", provider: "cloudflare-workers", title: `Created Worker ${worker.name}`, projectName: worker.name, targetId: worker.accountId });
    return worker;
  });
  handle("cloudflare:updateWorker", async (accountId, scriptName, patch) => {
    const worker = await updateWorker(String(accountId), String(scriptName), patch as never);
    await addActivity({ kind: "worker-updated", provider: "cloudflare-workers", title: `Updated Worker ${worker.name}`, projectName: worker.name, targetId: worker.accountId });
    return worker;
  });
  handle("cloudflare:uploadWorker", async (input) => {
    const result = await uploadWorker(input as never);
    await addActivity({ kind: "worker-updated", provider: "cloudflare-workers", title: `Uploaded Worker ${result.resourceName ?? "bundle"}`, projectName: result.resourceName, targetId: result.resourceId });
    return result;
  });
  handle("cloudflare:downloadWorker", (accountId, scriptName) => downloadWorker(String(accountId), String(scriptName)));
  handle("cloudflare:deleteWorker", async (accountId, scriptName) => {
    await deleteWorker(String(accountId), String(scriptName));
    await addActivity({ kind: "worker-deleted", provider: "cloudflare-workers", title: `Deleted Worker ${scriptName}`, projectName: String(scriptName), targetId: String(accountId) });
  });
  handle("cloudflare:workerSchedules", (accountId, scriptName) => listWorkerSchedules(String(accountId), String(scriptName)));
  handle("cloudflare:updateWorkerSchedules", async (accountId, scriptName, schedules) => {
    await updateWorkerSchedules(String(accountId), String(scriptName), schedules as never);
    await addActivity({ kind: "worker-schedules-updated", provider: "cloudflare-workers", title: `Updated schedules for ${scriptName}`, projectName: String(scriptName), targetId: String(accountId) });
  });
  handle("cloudflare:workerSubdomain", (accountId, scriptName) => getWorkerSubdomain(String(accountId), String(scriptName)));
  handle("cloudflare:updateWorkerSubdomain", async (accountId, scriptName, state) => {
    await updateWorkerSubdomain(String(accountId), String(scriptName), state as never);
    await addActivity({ kind: "worker-updated", provider: "cloudflare-workers", title: `Updated workers.dev for ${scriptName}`, projectName: String(scriptName), targetId: String(accountId) });
  });
  handle("cloudflare:triggerWorkerBuild", async (accountId, scriptName, branch, commitSha) => {
    const result = await triggerWorkerBuild(String(accountId), String(scriptName), String(branch), commitSha as string | undefined);
    await addActivity({ kind: "deployment-created", provider: "cloudflare-workers", title: `Triggered Worker build for ${scriptName}`, projectName: String(scriptName), targetId: result.resourceId });
    return result;
  });
  handle("cloudflare:workerVersions", (accountId, scriptName) => listWorkerVersions(String(accountId), String(scriptName)));
  handle("cloudflare:workerDeployments", (accountId, scriptName) =>
    listWorkerDeployments(String(accountId), String(scriptName)),
  );
  handle("cloudflare:deployWorkerVersion", async (accountId, scriptName, versionId, percentage, previousVersionId) => {
    await deployWorkerVersion(
      String(accountId),
      String(scriptName),
      String(versionId),
      percentage as number | undefined,
      previousVersionId as string | undefined,
    );
    await addActivity({
      kind: "worker-version-deployed",
      provider: "cloudflare-workers",
      title: "Deployed Worker version",
      projectName: String(scriptName),
      targetId: String(accountId),
    });
  });
  handle("cloudflare:restoreWorkerDeployment", async (accountId, scriptName, deploymentId) => {
    await restoreWorkerDeployment(String(accountId), String(scriptName), String(deploymentId));
    await addActivity({
      kind: "deployment-rolled-back",
      provider: "cloudflare-workers",
      title: "Restored Worker deployment",
      projectName: String(scriptName),
      targetId: String(accountId),
    });
  });
  handle("cloudflare:workerRoutes", (accountId, scriptName) =>
    listWorkerRoutes(String(accountId), scriptName as string | undefined),
  );
  handle("cloudflare:createWorkerRoute", async (accountId, scriptName, zoneId, pattern) => {
    await createWorkerRoute(String(accountId), String(scriptName), String(zoneId), String(pattern));
    await addActivity({
      kind: "domain-added",
      provider: "cloudflare-workers",
      title: `Added route ${pattern}`,
      projectName: String(scriptName),
    });
  });
  handle("cloudflare:deleteWorkerRoute", async (zoneId, routeId) => {
    await deleteWorkerRoute(String(zoneId), String(routeId));
    await addActivity({
      kind: "domain-removed",
      provider: "cloudflare-workers",
      title: "Removed Worker route",
    });
  });
  handle("cloudflare:workerDomains", (accountId, scriptName) =>
    listWorkerDomains(String(accountId), scriptName as string | undefined),
  );
  handle("cloudflare:attachWorkerDomain", async (accountId, scriptName, hostname, zoneId) => {
    await attachWorkerDomain(String(accountId), String(scriptName), String(hostname), String(zoneId));
    await addActivity({ kind: "domain-added", provider: "cloudflare-workers", title: `Attached ${hostname}`, projectName: String(scriptName) });
  });
  handle("cloudflare:detachWorkerDomain", async (accountId, domainId) => {
    await detachWorkerDomain(String(accountId), String(domainId));
    await addActivity({ kind: "domain-removed", provider: "cloudflare-workers", title: "Detached Worker domain" });
  });
  handle("cloudflare:workerVars", (accountId, scriptName) => listWorkerVars(String(accountId), String(scriptName)));
  handle("cloudflare:upsertWorkerVar", async (accountId, scriptName, name, value) => {
    await upsertWorkerVar(String(accountId), String(scriptName), String(name), String(value));
    await addActivity({ kind: "env-variable-changed", provider: "cloudflare-workers", title: `Updated ${name}`, projectName: String(scriptName), targetId: `${accountId}::${scriptName}` });
  });
  handle("cloudflare:deleteWorkerVar", async (accountId, scriptName, name) => {
    await deleteWorkerVar(String(accountId), String(scriptName), String(name));
    await addActivity({ kind: "env-variable-deleted", provider: "cloudflare-workers", title: `Deleted ${name}`, projectName: String(scriptName), targetId: `${accountId}::${scriptName}` });
  });
  handle("cloudflare:workerSecrets", (accountId, scriptName) => listWorkerSecrets(String(accountId), String(scriptName)));
  handle("cloudflare:putWorkerSecret", async (accountId, scriptName, name, value) => {
    await putWorkerSecret(String(accountId), String(scriptName), String(name), String(value));
    await addActivity({ kind: "worker-secret-changed", provider: "cloudflare-workers", title: `Set secret ${name}`, projectName: String(scriptName) });
  });
  handle("cloudflare:deleteWorkerSecret", async (accountId, scriptName, name) => {
    await deleteWorkerSecret(String(accountId), String(scriptName), String(name));
    await addActivity({ kind: "worker-secret-changed", provider: "cloudflare-workers", title: `Deleted secret ${name}`, projectName: String(scriptName) });
  });
  handle("cloudflare:startWorkerTail", (accountId, scriptName) => startWorkerTail(String(accountId), String(scriptName)));
  handle("cloudflare:stopWorkerTail", (sessionId) => stopWorkerTail(String(sessionId)));
  handle("cloudflare:zones", (accountId, query) => listZones(accountId as string | undefined, query as string | undefined));
  handle("cloudflare:dnsRecords", (zoneId, query) => listDnsRecords(String(zoneId), query as never));
  handle("cloudflare:createDnsRecord", async (input) => {
    const record = await createDnsRecord(input as never);
    await addActivity({ kind: "dns-record-created", provider: "cloudflare", title: `Created ${record.type} ${record.name}`, targetId: record.zoneId });
    return record;
  });
  handle("cloudflare:updateDnsRecord", async (recordId, input) => {
    const record = await updateDnsRecord(String(recordId), input as never);
    await addActivity({ kind: "dns-record-updated", provider: "cloudflare", title: `Updated ${record.type} ${record.name}`, targetId: record.zoneId });
    return record;
  });
  handle("cloudflare:deleteDnsRecord", async (zoneId, recordId) => {
    await deleteDnsRecord(String(zoneId), String(recordId));
    await addActivity({ kind: "dns-record-deleted", provider: "cloudflare", title: "Deleted DNS record", targetId: String(zoneId) });
  });
  handle("cloudflare:batchDnsRecords", async (input) => {
    await batchDnsRecords(input as never);
    await addActivity({ kind: "dns-record-updated", provider: "cloudflare", title: "Applied batch DNS changes", targetId: String((input as { zoneId?: string }).zoneId ?? "") });
  });
  handle("cloudflare:importDnsRecords", async (zoneId, bind) => {
    const result = await importDnsRecords(String(zoneId), String(bind));
    await addActivity({ kind: "dns-record-created", provider: "cloudflare", title: `Imported ${result.added} DNS records`, targetId: String(zoneId) });
    return result;
  });
  handle("cloudflare:exportDnsRecords", (zoneId) => exportDnsRecords(String(zoneId)));

  handle("prefs:get", () => getPreferences());
  handle("prefs:set", (patch) => setPreferences(patch as Partial<AppPreferences>));
  handle("activity:list", () => listActivity());
  handle("activity:clear", () => clearActivity());
  handle("window:getBounds", () => getWindowBounds());
  handle("app:getVersion", async () => app.getVersion());
  handle("shell:openHttps", async (url) => {
    const value = String(url);
    if (!value.startsWith("https://")) {
      throw new Error("Only https URLs can be opened.");
    }
    await shell.openExternal(value);
  });
  handle("files:saveText", async (defaultName, contents) => {
    const window = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(window ?? BrowserWindow.getAllWindows()[0], {
      defaultPath: String(defaultName),
      filters: [{ name: "Text", extensions: ["txt", "log"] }],
    });
    if (result.canceled || !result.filePath) return false;
    const { writeFile } = await import("node:fs/promises");
    await writeFile(result.filePath, String(contents), "utf8");
    return true;
  });
  handle("files:openText", async (options) => {
    const value = (options ?? {}) as { extensions?: string[]; title?: string };
    const window = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(window ?? BrowserWindow.getAllWindows()[0], {
      title: value.title ?? "Open text file",
      properties: ["openFile"],
      filters: value.extensions?.length ? [{ name: "Text", extensions: value.extensions }] : undefined,
    });
    const filePath = result.filePaths[0];
    if (result.canceled || !filePath) return null;
    const { readFile } = await import("node:fs/promises");
    const { basename } = await import("node:path");
    return { name: basename(filePath), contents: await readFile(filePath, "utf8") };
  });
  handle("files:selectLocalSource", (kind) => selectLocalSource(kind as never));
  handle("files:releaseLocalSource", async (sourceId) => releaseLocalSource(String(sourceId)));
  handle("operations:cancel", async (operationId) => cancelOperation(String(operationId)));
}
