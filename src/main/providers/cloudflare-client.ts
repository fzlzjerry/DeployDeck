import { Cloudflare } from "cloudflare";
import type { BrowserWindow } from "electron";
import type {
  DeploymentLogEntry,
  DnsRecord,
  DnsRecordType,
  DnsZone,
  EnvironmentVariable,
  PagesDeploymentDetail,
  Paginated,
  UnifiedDeployment,
  UnifiedDomain,
  UnifiedProject,
  WorkerDeployment,
  WorkerScript,
  WorkerVersion,
} from "@shared/models";
import type { DnsRecordInput, PagesEnvInput } from "@shared/api-contract";
import { httpsUrl } from "@shared/provider-types";
import { readToken } from "../credentials";
import { getPreferences } from "../preferences";
import { wrapProvider } from "./errors";
import {
  normalizeDnsRecord,
  normalizePagesDeployment,
  normalizePagesDeploymentDetail,
  normalizePagesDomain,
  normalizePagesEnv,
  normalizePagesLogs,
  normalizePagesProject,
  normalizeWorkerDeployment,
  normalizeWorkerScript,
  normalizeWorkerTailEvent,
  normalizeWorkerVersion,
  normalizeZone,
  workerDeploymentAsUnified,
} from "./cloudflare-normalize";

let cached: { token: string; client: Cloudflare } | null = null;

const tailSessions = new Map<
  string,
  {
    socket: WebSocket;
    accountId: string;
    scriptName: string;
    tailId: string;
  }
>();

let mainWindowRef: BrowserWindow | null = null;

export function setCloudflareWindow(window: BrowserWindow | null): void {
  mainWindowRef = window;
}

async function client(): Promise<Cloudflare> {
  const token = await readToken("cloudflare");
  if (!token) {
    throw new Error("Cloudflare is not connected.");
  }
  if (!cached || cached.token !== token) {
    cached = { token, client: new Cloudflare({ apiToken: token }) };
  }
  return cached.client;
}

export function resetCloudflareClient(): void {
  cached = null;
  for (const [id, session] of tailSessions) {
    try {
      session.socket.close();
    } catch {
      // ignore
    }
    tailSessions.delete(id);
  }
}

export async function connectCloudflare(token: string): Promise<Array<{ id: string; name: string }>> {
  const cf = new Cloudflare({ apiToken: token.trim() });
  const accounts: Array<{ id: string; name: string }> = [];
  await wrapProvider("cloudflare", async () => {
    for await (const account of cf.accounts.list()) {
      accounts.push({ id: account.id, name: account.name });
      if (accounts.length >= 50) break;
    }
  });
  cached = { token: token.trim(), client: cf };
  return accounts;
}

export async function listCloudflareAccounts(): Promise<Array<{ id: string; name: string }>> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const accounts: Array<{ id: string; name: string }> = [];
    for await (const account of cf.accounts.list()) {
      accounts.push({ id: account.id, name: account.name });
      if (accounts.length >= 50) break;
    }
    return accounts;
  });
}

export async function resolveCloudflareAccounts(accountId?: string): Promise<Array<{ id: string; name: string }>> {
  const accounts = await listCloudflareAccounts();
  const prefs = await getPreferences();
  const selected = accountId ?? prefs.cloudflareAccountId;
  if (selected && selected !== "all") {
    const match = accounts.find((account) => account.id === selected);
    return match ? [match] : accounts;
  }
  return accounts;
}

async function collect<T>(iterable: AsyncIterable<T>, limit = 200): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
    if (items.length >= limit) break;
  }
  return items;
}

export async function listPagesProjects(accountId?: string, query?: string): Promise<UnifiedProject[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const accounts = await resolveCloudflareAccounts(accountId);
    const projects: UnifiedProject[] = [];
    for (const account of accounts) {
      const rows = await collect(cf.pages.projects.list({ account_id: account.id }));
      projects.push(
        ...rows.map((project) => normalizePagesProject(project as unknown as Record<string, unknown>, account)),
      );
    }
    if (!query) return projects;
    const q = query.toLowerCase();
    return projects.filter((project) => project.name.toLowerCase().includes(q));
  });
}

export async function getPagesProject(accountId: string, projectName: string): Promise<UnifiedProject> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const accounts = await listCloudflareAccounts();
    const account = accounts.find((item) => item.id === accountId) ?? { id: accountId, name: accountId };
    const project = await cf.pages.projects.get(projectName, { account_id: accountId });
    return normalizePagesProject(project as unknown as Record<string, unknown>, account);
  });
}

export async function listPagesDeployments(input: {
  accountId?: string;
  projectName?: string;
  environment?: string;
  cursor?: string;
  limit?: number;
  query?: string;
  state?: string;
  branch?: string;
}): Promise<Paginated<UnifiedDeployment>> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const accounts = await resolveCloudflareAccounts(input.accountId);
    const projectFilter = input.projectName;
    const all: UnifiedDeployment[] = [];
    for (const account of accounts) {
      const projects = projectFilter
        ? [{ name: projectFilter }]
        : (await collect(cf.pages.projects.list({ account_id: account.id }))).map((project) => {
            const row = project as unknown as { name?: string; project_name?: string };
            return { name: row.name ?? row.project_name ?? "" };
          });
      for (const project of projects) {
        if (!project.name) continue;
        const rows = await collect(
          cf.pages.projects.deployments.list(project.name, {
            account_id: account.id,
            env:
              input.environment === "production" || input.environment === "preview"
                ? input.environment
                : undefined,
          }),
          80,
        );
        all.push(
          ...rows.map((deployment) =>
            normalizePagesDeployment(deployment as unknown as Record<string, unknown>, project.name, account),
          ),
        );
      }
    }
    let items = all.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (input.state && input.state !== "all") {
      items = items.filter((item) => item.state === input.state);
    }
    if (input.branch) {
      items = items.filter((item) => item.branch === input.branch);
    }
    if (input.query) {
      const q = input.query.toLowerCase();
      items = items.filter((item) =>
        [item.projectName, item.url, item.branch, item.commitSha, item.commitMessage]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)),
      );
    }
    const limit = input.limit ?? 20;
    const offset = input.cursor ? Number(input.cursor) : 0;
    const slice = items.slice(offset, offset + limit);
    const nextOffset = offset + slice.length;
    return {
      items: slice,
      nextCursor: nextOffset < items.length ? String(nextOffset) : undefined,
      hasMore: nextOffset < items.length,
    };
  });
}

export async function getPagesDeployment(
  accountId: string,
  projectName: string,
  deploymentId: string,
): Promise<PagesDeploymentDetail> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const accounts = await listCloudflareAccounts();
    const account = accounts.find((item) => item.id === accountId) ?? { id: accountId, name: accountId };
    const deployment = await cf.pages.projects.deployments.get(projectName, deploymentId, { account_id: accountId });
    return normalizePagesDeploymentDetail(deployment as unknown as Record<string, unknown>, projectName, account);
  });
}

export async function getPagesLogs(
  accountId: string,
  projectName: string,
  deploymentId: string,
): Promise<DeploymentLogEntry[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const logs = await cf.pages.projects.deployments.history.logs.get(projectName, deploymentId, {
      account_id: accountId,
    });
    return normalizePagesLogs(logs.data ?? []);
  });
}

export async function retryPagesDeployment(accountId: string, projectName: string, deploymentId: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.deployments.retry(projectName, deploymentId, { account_id: accountId, body: {} });
  });
}

export async function rollbackPagesDeployment(accountId: string, projectName: string, deploymentId: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.deployments.rollback(projectName, deploymentId, { account_id: accountId, body: {} });
  });
}

export async function deletePagesDeployment(accountId: string, projectName: string, deploymentId: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.deployments.delete(projectName, deploymentId, { account_id: accountId });
  });
}

export async function listPagesDomains(accountId: string, projectName: string): Promise<UnifiedDomain[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const accounts = await listCloudflareAccounts();
    const account = accounts.find((item) => item.id === accountId) ?? { id: accountId, name: accountId };
    const rows = await collect(cf.pages.projects.domains.list(projectName, { account_id: accountId }));
    return rows.map((domain) => normalizePagesDomain(domain as unknown as Record<string, unknown>, projectName, account));
  });
}

export async function addPagesDomain(accountId: string, projectName: string, name: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.domains.create(projectName, { account_id: accountId, name });
  });
}

export async function removePagesDomain(accountId: string, projectName: string, name: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.domains.delete(projectName, name, { account_id: accountId });
  });
}

export async function retryPagesDomain(accountId: string, projectName: string, name: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.domains.edit(projectName, name, { account_id: accountId, body: {} } as never);
  });
}

export async function listPagesEnv(
  accountId: string,
  projectName: string,
  environment: "production" | "preview",
): Promise<EnvironmentVariable[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const project = (await cf.pages.projects.get(projectName, { account_id: accountId })) as {
      deployment_configs?: { production?: { env_vars?: Record<string, Record<string, unknown>> }; preview?: { env_vars?: Record<string, Record<string, unknown>> } };
    };
    const vars = project.deployment_configs?.[environment]?.env_vars ?? {};
    return Object.entries(vars).map(([name, value]) =>
      normalizePagesEnv(name, value, projectName, accountId, environment),
    );
  });
}

export async function upsertPagesEnv(input: PagesEnvInput): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.edit(input.projectName, {
      account_id: input.accountId,
      deployment_configs: {
        [input.environment]: {
          env_vars: {
            [input.name]: {
              type: input.secret ? "secret_text" : "plain_text",
              value: input.value,
            },
          },
        },
      },
    });
  });
}

export async function deletePagesEnv(
  accountId: string,
  projectName: string,
  environment: "production" | "preview",
  name: string,
): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.edit(projectName, {
      account_id: accountId,
      deployment_configs: {
        [environment]: {
          env_vars: {
            [name]: null,
          },
        },
      },
    } as never);
  });
}

export async function listWorkers(accountId?: string, query?: string): Promise<WorkerScript[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const accounts = await resolveCloudflareAccounts(accountId);
    const scripts: WorkerScript[] = [];
    for (const account of accounts) {
      const rows = await collect(cf.workers.scripts.list({ account_id: account.id }));
      const zones = await collect(cf.zones.list({ account: { id: account.id } } as never)).catch(() => []);
      const routes: Array<{ script?: string; pattern?: string }> = [];
      for (const zone of zones) {
        const zoneRoutes = await collect(cf.workers.routes.list({ zone_id: zone.id })).catch(() => []);
        routes.push(...zoneRoutes);
      }
      const domains = await collect(cf.workers.domains.list({ account_id: account.id })).catch(() => []);
      for (const script of rows) {
        const name = String(script.id ?? "");
        const scriptRoutes = routes
          .filter((route) => (route as { script?: string }).script === name)
          .map((route) => (route as { pattern?: string }).pattern ?? "");
        const scriptDomains = domains
          .filter((domain) => (domain as { service?: string }).service === name)
          .map((domain) => (domain as { hostname?: string }).hostname ?? "");
        let activeVersionId: string | undefined;
        let activeDeploymentId: string | undefined;
        try {
          const deployments = await cf.workers.scripts.deployments.list(name, { account_id: account.id });
          const latest = deployments.deployments[0];
          activeDeploymentId = latest?.id;
          activeVersionId = latest?.versions?.[0]?.version_id;
        } catch {
          // versions API may be unavailable for older scripts
        }
        scripts.push(
          normalizeWorkerScript(script as unknown as Record<string, unknown>, account, {
            routes: scriptRoutes,
            domains: scriptDomains,
            activeDeploymentId,
            activeVersionId,
          }),
        );
      }
    }
    if (!query) return scripts;
    const q = query.toLowerCase();
    return scripts.filter((script) => script.name.toLowerCase().includes(q));
  });
}

export async function getWorker(accountId: string, scriptName: string): Promise<WorkerScript> {
  const scripts = await listWorkers(accountId, scriptName);
  const match = scripts.find((script) => script.name === scriptName);
  if (!match) {
    throw new Error("The Worker no longer exists.");
  }
  return match;
}

export async function listWorkerVersions(accountId: string, scriptName: string): Promise<WorkerVersion[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const rows = await collect(cf.workers.scripts.versions.list(scriptName, { account_id: accountId }));
    let traffic = new Map<string, number>();
    try {
      const deployments = await cf.workers.scripts.deployments.list(scriptName, { account_id: accountId });
      const latest = deployments.deployments[0];
      traffic = new Map((latest?.versions ?? []).map((item) => [item.version_id, item.percentage]));
    } catch {
      traffic = new Map();
    }
    return rows.map((version) =>
      normalizeWorkerVersion(version as unknown as Record<string, unknown>, scriptName, accountId, traffic.get(String((version as { id?: string }).id))),
    );
  });
}

export async function listWorkerDeployments(accountId: string, scriptName: string): Promise<WorkerDeployment[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const accounts = await listCloudflareAccounts();
    const account = accounts.find((item) => item.id === accountId) ?? { id: accountId, name: accountId };
    const listed = await cf.workers.scripts.deployments.list(scriptName, { account_id: accountId });
    return listed.deployments.map((row) => normalizeWorkerDeployment(row as unknown as Record<string, unknown>, scriptName, account));
  });
}

export async function listWorkerDeploymentsAsUnified(accountId?: string): Promise<UnifiedDeployment[]> {
  const accounts = await resolveCloudflareAccounts(accountId);
  const items: UnifiedDeployment[] = [];
  for (const account of accounts) {
    const scripts = await listWorkers(account.id);
    for (const script of scripts) {
      const deployments = await listWorkerDeployments(account.id, script.name).catch(() => []);
      items.push(...deployments.map((deployment) => workerDeploymentAsUnified(deployment, script.name, account)));
    }
  }
  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function deployWorkerVersion(
  accountId: string,
  scriptName: string,
  versionId: string,
  percentage = 100,
  previousVersionId?: string,
): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    const versions =
      previousVersionId && percentage < 100
        ? [
            { version_id: versionId, percentage },
            { version_id: previousVersionId, percentage: 100 - percentage },
          ]
        : [{ version_id: versionId, percentage: 100 }];
    await cf.workers.scripts.deployments.create(scriptName, {
      account_id: accountId,
      strategy: "percentage",
      versions,
    });
  });
}

export async function restoreWorkerDeployment(
  accountId: string,
  scriptName: string,
  deploymentId: string,
): Promise<void> {
  const deployments = await listWorkerDeployments(accountId, scriptName);
  const match = deployments.find((item) => item.id === deploymentId);
  if (!match || match.versions.length === 0) {
    throw new Error("That Worker deployment no longer exists.");
  }
  const primary = match.versions[0];
  const secondary = match.versions[1];
  await deployWorkerVersion(accountId, scriptName, primary.versionId, primary.percentage, secondary?.versionId);
}

export async function listWorkerRoutes(accountId: string, scriptName?: string) {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const zones = await collect(cf.zones.list({ account: { id: accountId } } as never));
    const rows: Array<{ id?: string; pattern?: string; script?: string; zone_name?: string }> = [];
    for (const zone of zones) {
      const zoneRoutes = await collect(cf.workers.routes.list({ zone_id: zone.id })).catch(() => []);
      rows.push(...zoneRoutes.map((route) => ({ ...route, zone_name: zone.name })));
    }
    return rows
      .filter((route) => !scriptName || (route as { script?: string }).script === scriptName)
      .map((route) => ({
        id: String((route as { id?: string }).id ?? ""),
        pattern: String((route as { pattern?: string }).pattern ?? ""),
        script: String((route as { script?: string }).script ?? ""),
        zoneName: (route as { zone_name?: string }).zone_name,
      }));
  });
}

export async function listWorkerDomains(accountId: string, scriptName?: string): Promise<UnifiedDomain[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const accounts = await listCloudflareAccounts();
    const account = accounts.find((item) => item.id === accountId) ?? { id: accountId, name: accountId };
    const rows = await collect(cf.workers.domains.list({ account_id: accountId }));
    return rows
      .filter((domain) => !scriptName || (domain as { service?: string }).service === scriptName)
      .map((domain) => ({
        id: String((domain as { id?: string }).id ?? (domain as { hostname?: string }).hostname ?? ""),
        provider: "cloudflare-workers" as const,
        accountId: account.id,
        accountName: account.name,
        projectId: String((domain as { service?: string }).service ?? ""),
        projectName: String((domain as { service?: string }).service ?? ""),
        name: String((domain as { hostname?: string }).hostname ?? ""),
        status: String((domain as { zone_name?: string }).zone_name ?? "attached"),
        verified: true,
      }));
  });
}

export async function attachWorkerDomain(
  accountId: string,
  scriptName: string,
  hostname: string,
  zoneId: string,
): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.workers.domains.update({
      account_id: accountId,
      hostname,
      service: scriptName,
      zone_id: zoneId,
      environment: "production",
    } as never);
  });
}

export async function detachWorkerDomain(accountId: string, domainId: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.workers.domains.delete(domainId, { account_id: accountId });
  });
}

interface Binding {
  type?: string;
  name?: string;
  text?: string;
}

export async function listWorkerVars(accountId: string, scriptName: string): Promise<EnvironmentVariable[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const settings = await cf.workers.scripts.scriptAndVersionSettings.get(scriptName, { account_id: accountId });
    const bindings = ((settings as { bindings?: Binding[] }).bindings ?? []).filter((binding) => binding.type === "plain_text");
    return bindings.map((binding) => ({
      id: `${accountId}:${scriptName}:${binding.name}`,
      provider: "cloudflare-workers" as const,
      accountId,
      projectId: scriptName,
      projectName: scriptName,
      key: String(binding.name ?? ""),
      type: "plain" as const,
      targets: ["production"],
      valueMasked: true,
      value: binding.text,
    }));
  });
}

export async function upsertWorkerVar(accountId: string, scriptName: string, name: string, value: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    const settings = await cf.workers.scripts.scriptAndVersionSettings.get(scriptName, { account_id: accountId });
    const bindings = ([...((settings as { bindings?: Binding[] }).bindings ?? [])] as Binding[]).filter(Boolean);
    const index = bindings.findIndex((binding) => binding.name === name && binding.type === "plain_text");
    const next = { type: "plain_text", name, text: value };
    if (index >= 0) bindings[index] = next;
    else bindings.push(next);
    await cf.workers.scripts.scriptAndVersionSettings.edit(scriptName, {
      account_id: accountId,
      settings: { bindings },
    } as never);
  });
}

export async function deleteWorkerVar(accountId: string, scriptName: string, name: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    const settings = await cf.workers.scripts.scriptAndVersionSettings.get(scriptName, { account_id: accountId });
    const bindings = ((settings as { bindings?: Binding[] }).bindings ?? []).filter(
      (binding) => !(binding.name === name && binding.type === "plain_text"),
    );
    await cf.workers.scripts.scriptAndVersionSettings.edit(scriptName, {
      account_id: accountId,
      settings: { bindings },
    } as never);
  });
}

export async function listWorkerSecrets(accountId: string, scriptName: string): Promise<EnvironmentVariable[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const rows = await collect(cf.workers.scripts.secrets.list(scriptName, { account_id: accountId }));
    return rows.map((secret) => ({
      id: `${accountId}:${scriptName}:secret:${(secret as { name?: string }).name}`,
      provider: "cloudflare-workers" as const,
      accountId,
      projectId: scriptName,
      projectName: scriptName,
      key: String((secret as { name?: string }).name ?? ""),
      type: "secret" as const,
      targets: ["production"],
      valueMasked: true,
    }));
  });
}

export async function putWorkerSecret(accountId: string, scriptName: string, name: string, value: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.workers.scripts.secrets.update(scriptName, {
      account_id: accountId,
      name,
      text: value,
      type: "secret_text",
    });
  });
}

export async function deleteWorkerSecret(accountId: string, scriptName: string, name: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.workers.scripts.secrets.delete(scriptName, name, { account_id: accountId });
  });
}

export async function startWorkerTail(accountId: string, scriptName: string): Promise<{ sessionId: string }> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const tail = await cf.workers.scripts.tail.create(scriptName, { account_id: accountId, body: {} });
    const sessionId = tail.id;
    const socket = new WebSocket(tail.url);
    let index = 0;
    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as Record<string, unknown>;
        const entries = normalizeWorkerTailEvent(payload, sessionId, index);
        index += 1;
        for (const entry of entries) {
          mainWindowRef?.webContents.send("host:worker-tail", { sessionId, entry });
        }
      } catch {
        // ignore malformed tail frames
      }
    });
    socket.addEventListener("error", () => {
      mainWindowRef?.webContents.send("host:worker-tail", {
        sessionId,
        entry: {
          id: `${sessionId}-error`,
          level: "error",
          message: "The Worker tail session disconnected.",
        },
      });
    });
    tailSessions.set(sessionId, { socket, accountId, scriptName, tailId: tail.id });
    return { sessionId };
  });
}

export async function stopWorkerTail(sessionId: string): Promise<void> {
  const session = tailSessions.get(sessionId);
  if (!session) return;
  try {
    session.socket.close();
  } catch {
    // ignore
  }
  tailSessions.delete(sessionId);
  try {
    const cf = await client();
    await cf.workers.scripts.tail.delete(session.scriptName, session.tailId, { account_id: session.accountId });
  } catch {
    // the session may already have expired
  }
}

export async function listZones(accountId?: string, query?: string): Promise<DnsZone[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const accounts = await resolveCloudflareAccounts(accountId);
    const zones: DnsZone[] = [];
    for (const account of accounts) {
      const rows = await collect(cf.zones.list({ account: { id: account.id } } as never));
      zones.push(...rows.map((zone) => normalizeZone(zone as unknown as Record<string, unknown>, account)));
    }
    if (!query) return zones;
    const q = query.toLowerCase();
    return zones.filter((zone) => zone.name.toLowerCase().includes(q));
  });
}

export async function listDnsRecords(
  zoneId: string,
  query?: { search?: string; type?: DnsRecordType | "all"; proxied?: boolean; page?: number },
): Promise<Paginated<DnsRecord>> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const zone = await cf.zones.get({ zone_id: zoneId });
    const page = query?.page ?? 1;
    const listed = await cf.dns.records.list({
      zone_id: zoneId,
      page,
      per_page: 50,
      type: query?.type && query.type !== "all" ? query.type : undefined,
      search: query?.search,
      proxied: query?.proxied,
    } as never);
    const rows = await collect(listed as unknown as AsyncIterable<Record<string, unknown>>, 50);
    let items = rows.map((record) => normalizeDnsRecord(record, { id: zoneId, name: zone.name }));
    if (query?.search) {
      const q = query.search.toLowerCase();
      items = items.filter((record) => record.name.toLowerCase().includes(q) || record.content.toLowerCase().includes(q));
    }
    const resultInfo = (listed as { result_info?: { page?: number; total_pages?: number } }).result_info;
    return {
      items,
      nextCursor: resultInfo && (resultInfo.page ?? page) < (resultInfo.total_pages ?? page) ? String(page + 1) : undefined,
      hasMore: Boolean(resultInfo && (resultInfo.page ?? page) < (resultInfo.total_pages ?? page)),
    };
  });
}

function recordBody(input: DnsRecordInput) {
  const base = {
    type: input.type,
    name: input.name,
    content: input.content,
    ttl: input.ttl,
    comment: input.comment,
    proxied: input.type === "A" || input.type === "AAAA" || input.type === "CNAME" ? input.proxied : undefined,
    priority: input.type === "MX" || input.type === "SRV" ? input.priority : undefined,
    data: input.type === "CAA" || input.type === "SRV" ? input.data : undefined,
  };
  return base;
}

export async function createDnsRecord(input: DnsRecordInput): Promise<DnsRecord> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const created = await cf.dns.records.create({
      zone_id: input.zoneId,
      ...recordBody(input),
    } as never);
    const zone = await cf.zones.get({ zone_id: input.zoneId });
    return normalizeDnsRecord(created as unknown as Record<string, unknown>, { id: input.zoneId, name: zone.name });
  });
}

export async function updateDnsRecord(recordId: string, input: DnsRecordInput): Promise<DnsRecord> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const updated = await cf.dns.records.update(recordId, {
      zone_id: input.zoneId,
      ...recordBody(input),
    } as never);
    const zone = await cf.zones.get({ zone_id: input.zoneId });
    return normalizeDnsRecord(updated as unknown as Record<string, unknown>, { id: input.zoneId, name: zone.name });
  });
}

export async function deleteDnsRecord(zoneId: string, recordId: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.dns.records.delete(recordId, { zone_id: zoneId });
  });
}

export function pagesOpenUrl(url?: string): string | undefined {
  return url ? httpsUrl(url) : undefined;
}
