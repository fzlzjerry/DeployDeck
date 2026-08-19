import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Cloudflare, toFile } from "cloudflare";
import { build } from "esbuild";
import { dialog, type BrowserWindow } from "electron";
import type {
  DeploymentLogEntry,
  DnsRecord,
  DnsZone,
  EnvironmentVariable,
  OperationResult,
  PagesDeploymentDetail,
  Paginated,
  ProjectCreateInput,
  ProjectPatchInput,
  SupportedDnsRecordType,
  UnifiedDeployment,
  UnifiedDomain,
  UnifiedProject,
  WorkerDeployment,
  WorkerRoute,
  WorkerSchedule,
  WorkerScript,
  WorkerVersion,
} from "@shared/models";
import type {
  CreateDeploymentInput,
  DnsBatchInput,
  DnsRecordInput,
  PagesEnvInput,
  WorkerSubdomainState,
  WorkerUploadInput,
} from "@shared/api-contract";
import { httpsUrl } from "@shared/provider-types";
import { readToken } from "../credentials";
import { localSourceRoot, resolveLocalSource } from "../local-sources";
import { beginOperation, completeOperation, failOperation, updateOperation } from "../operations";
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
    cached = null;
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

function splitRepository(repository: string): { owner?: string; repoName: string } {
  const normalized = repository
    .trim()
    .replace(/^git@[^:]+:/, "")
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "");
  const parts = normalized.split("/").filter(Boolean);
  return { owner: parts.length > 1 ? parts.at(-2) : undefined, repoName: parts.at(-1) ?? normalized };
}

export async function createPagesProject(input: ProjectCreateInput): Promise<UnifiedProject> {
  if (input.provider !== "cloudflare-pages") throw new Error("Choose Cloudflare Pages as the project provider.");
  if (!input.accountId) throw new Error("Choose a Cloudflare account.");
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const accounts = await listCloudflareAccounts();
    const account = accounts.find((item) => item.id === input.accountId) ?? { id: input.accountId!, name: input.accountId! };
    const source = input.source.kind === "git" ? input.source : undefined;
    const repository = source ? splitRepository(source.repository) : undefined;
    const created = await cf.pages.projects.create({
      account_id: input.accountId!,
      name: input.name,
      production_branch: input.productionBranch || "main",
      build_config: {
        build_command: input.buildCommand,
        destination_dir: input.outputDirectory,
        root_dir: input.rootDirectory,
      },
      source:
        source && (source.provider === "github" || source.provider === "gitlab")
          ? {
              type: source.provider,
              config: {
                owner: repository?.owner,
                repo_name: repository?.repoName,
                production_branch: input.productionBranch || source.branch,
                production_deployments_enabled: true,
                preview_deployment_setting: "all",
                pr_comments_enabled: true,
              },
            }
          : undefined,
    });
    return normalizePagesProject(created as unknown as Record<string, unknown>, account);
  });
}

export async function updatePagesProject(
  accountId: string,
  projectName: string,
  patch: ProjectPatchInput,
): Promise<UnifiedProject> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const accounts = await listCloudflareAccounts();
    const account = accounts.find((item) => item.id === accountId) ?? { id: accountId, name: accountId };
    const updated = await cf.pages.projects.edit(projectName, {
      account_id: accountId,
      name: patch.name,
      production_branch: patch.productionBranch,
      build_config: {
        build_caching: patch.buildCaching,
        build_command: patch.buildCommand,
        destination_dir: patch.outputDirectory,
        root_dir: patch.rootDirectory,
      },
      source: patch.previewDeployments
        ? {
            type: "github",
            config: { preview_deployment_setting: patch.previewDeployments },
          }
        : undefined,
    } as never);
    return normalizePagesProject(updated as unknown as Record<string, unknown>, account);
  });
}

export async function deletePagesProject(accountId: string, projectName: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.delete(projectName, { account_id: accountId });
  });
}

export async function purgePagesBuildCache(accountId: string, projectName: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.purgeBuildCache(projectName, { account_id: accountId });
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

export async function createPagesDeployment(input: CreateDeploymentInput): Promise<OperationResult> {
  if (!input.accountId || !input.projectName) throw new Error("Choose a Cloudflare Pages project.");
  const { operationId, signal } = beginOperation(`Preparing ${input.projectName} deployment`);
  try {
    const cf = await client();
    const deploymentSource = input.source;
    if (deploymentSource.kind === "git") {
      updateOperation(operationId, { phase: "creating", label: `Deploying ${deploymentSource.ref ?? deploymentSource.branch}` });
      const created = await wrapProvider("cloudflare", () =>
        cf.pages.projects.deployments.create(
          input.projectName!,
          {
            account_id: input.accountId!,
            branch: deploymentSource.ref ?? deploymentSource.branch,
            commit_hash: deploymentSource.commitSha,
          },
          { signal },
        ),
      );
      completeOperation(operationId, "Pages deployment created");
      return {
        operationId,
        provider: "cloudflare-pages",
        resourceKind: "deployment",
        resourceId: created.id,
        resourceName: input.projectName,
        dashboardUrl: created.url ? httpsUrl(created.url) : undefined,
      };
    }

    const source = resolveLocalSource(deploymentSource.sourceId);
    if (source.entries.length > 20_000) throw new Error("Cloudflare Pages Direct Upload supports at most 20,000 files.");
    const token = await wrapProvider("cloudflare", () =>
      cf.pages.projects.getUploadToken(input.projectName!, { account_id: input.accountId! }),
    );
    const uploadClient = new Cloudflare({ apiToken: token.jwt });
    const manifest: Record<string, string> = {};
    const prepared: Array<{ hash: string; value: string; contentType: string }> = [];
    let bytesCompleted = 0;
    for (let index = 0; index < source.entries.length; index += 1) {
      if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Operation canceled.");
      const entry = source.entries[index]!;
      const contents = await readFile(entry.absolutePath);
      const hash = createHash("sha256").update(contents).digest("hex");
      manifest[entry.relativePath] = hash;
      prepared.push({ hash, value: contents.toString("base64"), contentType: contentType(entry.relativePath) });
      bytesCompleted += entry.size;
      updateOperation(operationId, {
        phase: "hashing",
        label: `Hashing ${entry.relativePath}`,
        completed: index + 1,
        total: source.entries.length,
        bytesCompleted,
        bytesTotal: source.handle.totalBytes,
      });
    }

    const missing = await collect(uploadClient.pages.assets.checkMissing({ hashes: prepared.map((item) => item.hash) }), 20_000);
    const missingSet = new Set(missing);
    const uploads = prepared.filter((item) => missingSet.has(item.hash));
    for (let offset = 0; offset < uploads.length; offset += 50) {
      if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Operation canceled.");
      const batch = uploads.slice(offset, offset + 50);
      await uploadClient.pages.assets.upload(
        {
          body: batch.map((item) => ({
            key: item.hash,
            value: item.value,
            base64: true,
            metadata: { contentType: item.contentType },
          })),
        },
        { signal },
      );
      updateOperation(operationId, {
        phase: "uploading",
        label: `Uploading assets ${Math.min(offset + batch.length, uploads.length)} of ${uploads.length}`,
        completed: Math.min(offset + batch.length, uploads.length),
        total: Math.max(1, uploads.length),
      });
    }
    await uploadClient.pages.assets.upsertHashes({ hashes: prepared.map((item) => item.hash) }, { signal });
    const project = await getPagesProject(input.accountId, input.projectName);
    updateOperation(operationId, { phase: "creating", label: "Creating Pages deployment" });
    const created = await wrapProvider("cloudflare", () =>
      cf.pages.projects.deployments.create(
        input.projectName!,
        {
          account_id: input.accountId!,
          manifest: JSON.stringify(manifest),
          branch: input.target === "production" ? project.productionBranch ?? "main" : "deploydeck-local",
          commit_dirty: "true",
          commit_message: "DeployDeck local upload",
          pages_build_output_dir: source.handle.name,
        },
        { signal },
      ),
    );
    completeOperation(operationId, "Pages deployment created");
    return {
      operationId,
      provider: "cloudflare-pages",
      resourceKind: "deployment",
      resourceId: created.id,
      resourceName: input.projectName,
      dashboardUrl: created.url ? httpsUrl(created.url) : undefined,
    };
  } catch (error) {
    failOperation(operationId, error instanceof Error ? error.message : "Pages deployment failed");
    throw error;
  }
}

function contentType(file: string): string {
  const extension = path.extname(file).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml",
  }[extension] ?? "application/octet-stream";
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
    const deployment = await cf.pages.projects.deployments.get(deploymentId, {
      account_id: accountId,
      project_name: projectName,
    });
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
    const logs = await cf.pages.projects.deployments.history.logs.get(deploymentId, {
      account_id: accountId,
      project_name: projectName,
    });
    return normalizePagesLogs(logs.data ?? []);
  });
}

export async function retryPagesDeployment(accountId: string, projectName: string, deploymentId: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.deployments.retry(deploymentId, { account_id: accountId, project_name: projectName });
  });
}

export async function rollbackPagesDeployment(accountId: string, projectName: string, deploymentId: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.deployments.rollback(deploymentId, { account_id: accountId, project_name: projectName });
  });
}

export async function deletePagesDeployment(accountId: string, projectName: string, deploymentId: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.deployments.delete(deploymentId, { account_id: accountId, project_name: projectName });
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
    await cf.pages.projects.domains.delete(name, { account_id: accountId, project_name: projectName });
  });
}

export async function retryPagesDomain(accountId: string, projectName: string, name: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.pages.projects.domains.edit(name, { account_id: accountId, project_name: projectName });
  });
}

export async function listPagesEnv(
  accountId: string,
  projectName: string,
  environment: "production" | "preview",
): Promise<EnvironmentVariable[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const project = (await cf.pages.projects.get(projectName, { account_id: accountId })) as unknown as {
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

export async function createWorker(input: ProjectCreateInput): Promise<WorkerScript> {
  if (input.provider !== "cloudflare-workers") throw new Error("Choose Cloudflare Workers as the provider.");
  if (!input.accountId) throw new Error("Choose a Cloudflare account.");
  if (input.source.kind === "local") {
    await uploadWorker({
      accountId: input.accountId,
      scriptName: input.name,
      sourceId: input.source.sourceId,
      compatibilityDate: input.compatibilityDate,
      compatibilityFlags: input.compatibilityFlags,
      message: "Initial DeployDeck upload",
      deploy: true,
    });
    return getWorker(input.accountId, input.name);
  }
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    const module = await toFile(
      Buffer.from("export default { async fetch() { return new Response('Worker created by DeployDeck', { status: 503 }); } };"),
      "index.mjs",
      { type: "application/javascript+module" },
    );
    await cf.workers.scripts.update(input.name, {
      account_id: input.accountId!,
      metadata: {
        main_module: "index.mjs",
        compatibility_date: input.compatibilityDate ?? new Date().toISOString().slice(0, 10),
        compatibility_flags: input.compatibilityFlags,
      },
      files: [module],
    });
  });
  return getWorker(input.accountId, input.name);
}

export async function updateWorker(
  accountId: string,
  scriptName: string,
  patch: ProjectPatchInput,
): Promise<WorkerScript> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    const current = await cf.workers.scripts.scriptAndVersionSettings.get(scriptName, { account_id: accountId });
    const currentSettings = (current as { settings?: Record<string, unknown> }).settings ?? {};
    await cf.workers.scripts.scriptAndVersionSettings.edit(scriptName, {
      account_id: accountId,
      settings: {
        ...currentSettings,
        compatibility_date: patch.compatibilityDate,
        compatibility_flags: patch.compatibilityFlags,
        observability: patch.observability === undefined ? undefined : { enabled: patch.observability },
      },
    } as never);
  });
  return getWorker(accountId, scriptName);
}

export async function uploadWorker(input: WorkerUploadInput): Promise<OperationResult> {
  const { operationId, signal } = beginOperation(`Preparing ${input.scriptName}`);
  try {
    const source = resolveLocalSource(input.sourceId);
    const configuredEntrypoint = source.handle.detected?.entrypoint?.replace(/^\.\//, "");
    const entry =
      (configuredEntrypoint
        ? source.entries.find((item) => item.relativePath.replaceAll(path.sep, "/") === configuredEntrypoint)
        : undefined) ??
      ["src/index.ts", "src/index.tsx", "src/index.js", "src/index.mjs", "index.ts", "index.tsx", "index.js", "index.mjs", "worker.ts", "worker.js"]
        .map((candidate) => source.entries.find((item) => item.relativePath.replaceAll(path.sep, "/") === candidate))
        .find(Boolean) ??
      (source.handle.kind === "worker-entry" || source.handle.kind === "worker-bundle" ? source.entries[0] : undefined);
    if (!entry) throw new Error("No Worker entrypoint was found. Add `main` to wrangler.toml/jsonc or choose an entry file.");
    updateOperation(operationId, { phase: "preparing", label: `Bundling ${entry.relativePath}` });
    let code: Uint8Array;
    if (source.handle.kind === "worker-bundle") {
      code = await readFile(entry.absolutePath);
    } else {
      const built = await build({
        entryPoints: [entry.absolutePath],
        absWorkingDir: localSourceRoot(input.sourceId),
        bundle: true,
        format: "esm",
        platform: "neutral",
        target: "es2022",
        write: false,
        sourcemap: false,
        logLevel: "silent",
      });
      const output = built.outputFiles[0];
      if (!output) throw new Error("esbuild did not produce a Worker bundle.");
      code = output.contents;
    }
    if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Operation canceled.");
    const cf = await client();
    const module = await toFile(code, "index.mjs", { type: "application/javascript+module" });
    updateOperation(operationId, { phase: "uploading", label: `Uploading ${input.scriptName}` });
    const keepBindings = [
      "plain_text",
      "secret_text",
      "kv_namespace",
      "r2_bucket",
      "d1",
      "service",
      "queue",
      "durable_object_namespace",
    ];
    const metadata = {
      main_module: "index.mjs",
      compatibility_date: input.compatibilityDate ?? new Date().toISOString().slice(0, 10),
      compatibility_flags: input.compatibilityFlags,
      keep_bindings: keepBindings,
      annotations: input.message ? { "workers/message": input.message } : undefined,
    };
    const uploaded = input.deploy === false
      ? await wrapProvider("cloudflare", () => cf.workers.scripts.versions.create(input.scriptName, {
          account_id: input.accountId,
          metadata,
          files: [module],
        }, { signal }))
      : await wrapProvider("cloudflare", () => cf.workers.scripts.update(input.scriptName, {
          account_id: input.accountId,
          metadata: { ...metadata, keep_assets: true },
          files: [module],
        }, { signal }));
    completeOperation(operationId, input.deploy === false ? "Worker version uploaded" : "Worker deployed");
    return {
      operationId,
      provider: "cloudflare-workers",
      resourceKind: "worker",
      resourceId: input.deploy === false && "id" in uploaded ? String(uploaded.id ?? input.scriptName) : input.scriptName,
      resourceName: input.scriptName,
    };
  } catch (error) {
    failOperation(operationId, error instanceof Error ? error.message : "Worker upload failed");
    throw error;
  }
}

export async function downloadWorker(accountId: string, scriptName: string): Promise<boolean> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const response = await cf.workers.scripts.content.get(scriptName, { account_id: accountId });
    const data = Buffer.from(await response.arrayBuffer());
    const result = await dialog.showSaveDialog({ defaultPath: `${scriptName}.js`, title: "Save Worker source" });
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, data);
    return true;
  });
}

export async function deleteWorker(accountId: string, scriptName: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.workers.scripts.delete(scriptName, { account_id: accountId });
  });
}

export async function listWorkerSchedules(accountId: string, scriptName: string): Promise<WorkerSchedule[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const response = await cf.workers.scripts.schedules.get(scriptName, { account_id: accountId });
    return response.schedules.map((schedule) => ({ cron: schedule.cron, createdOn: schedule.created_on }));
  });
}

export async function updateWorkerSchedules(
  accountId: string,
  scriptName: string,
  schedules: WorkerSchedule[],
): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.workers.scripts.schedules.update(scriptName, {
      account_id: accountId,
      body: schedules.map((schedule) => ({ cron: schedule.cron })),
    });
  });
}

export async function getWorkerSubdomain(accountId: string, scriptName: string): Promise<WorkerSubdomainState> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const response = await cf.workers.scripts.subdomain.get(scriptName, { account_id: accountId });
    return { enabled: response.enabled, previewsEnabled: response.previews_enabled };
  });
}

export async function updateWorkerSubdomain(
  accountId: string,
  scriptName: string,
  state: WorkerSubdomainState,
): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    if (state.enabled) {
      await cf.workers.scripts.subdomain.create(scriptName, {
        account_id: accountId,
        enabled: true,
        previews_enabled: state.previewsEnabled,
      });
    } else {
      await cf.workers.scripts.subdomain.delete(scriptName, { account_id: accountId });
    }
  });
}

async function cloudflareBuildsRequest<T>(pathName: string, init?: RequestInit): Promise<T> {
  const token = await readToken("cloudflare");
  if (!token) throw new Error("Cloudflare is not connected.");
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathName}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json() as { success?: boolean; result?: T; errors?: Array<{ message?: string }> };
  if (!response.ok || payload.success === false) {
    throw new Error(payload.errors?.[0]?.message ?? `Cloudflare Builds request failed (${response.status}).`);
  }
  return payload.result as T;
}

export async function triggerWorkerBuild(
  accountId: string,
  scriptName: string,
  branch: string,
  commitSha?: string,
): Promise<OperationResult> {
  const { operationId } = beginOperation(`Preparing ${scriptName} build`);
  try {
    const cf = await client();
    const scripts = await collect(cf.workers.scripts.list({ account_id: accountId }));
    const script = scripts.find((item) => item.id === scriptName) as { tag?: string } | undefined;
    if (!script?.tag) throw new Error("Cloudflare did not return the immutable Worker tag required by Workers Builds.");
    const triggers = await cloudflareBuildsRequest<Array<Record<string, unknown>>>(
      `/accounts/${encodeURIComponent(accountId)}/builds/triggers?external_script_id=${encodeURIComponent(script.tag)}`,
    );
    const trigger = triggers.find((item) => {
      const includes = item.branch_includes;
      return Array.isArray(includes) && (includes.includes(branch) || includes.includes("*"));
    }) ?? triggers[0];
    const triggerId = String(trigger?.trigger_uuid ?? trigger?.uuid ?? trigger?.id ?? "");
    if (!triggerId) {
      throw new Error("No Workers Builds trigger is configured. Install the Cloudflare Git App and create a production or preview trigger first.");
    }
    updateOperation(operationId, { phase: "creating", label: `Triggering ${branch}` });
    const buildResult = await cloudflareBuildsRequest<Record<string, unknown>>(
      `/accounts/${encodeURIComponent(accountId)}/builds/triggers/${encodeURIComponent(triggerId)}/builds`,
      { method: "POST", body: JSON.stringify({ branch, ...(commitSha ? { commit_hash: commitSha } : {}) }) },
    );
    const buildId = String(buildResult.build_uuid ?? buildResult.uuid ?? buildResult.id ?? "");
    completeOperation(operationId, "Worker build triggered");
    return {
      operationId,
      provider: "cloudflare-workers",
      resourceKind: "deployment",
      resourceId: buildId,
      resourceName: scriptName,
    };
  } catch (error) {
    failOperation(operationId, error instanceof Error ? error.message : "Worker build failed");
    throw error;
  }
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

export async function listWorkerRoutes(accountId: string, scriptName?: string): Promise<WorkerRoute[]> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const zones = await collect(cf.zones.list({ account: { id: accountId } } as never));
    const rows: WorkerRoute[] = [];
    for (const zone of zones) {
      const zoneRoutes = await collect(cf.workers.routes.list({ zone_id: zone.id })).catch(() => []);
      for (const route of zoneRoutes) {
        const script = String((route as { script?: string }).script ?? "");
        if (scriptName && script !== scriptName) continue;
        rows.push({
          id: String((route as { id?: string }).id ?? ""),
          pattern: String((route as { pattern?: string }).pattern ?? ""),
          script,
          zoneId: zone.id,
          zoneName: zone.name,
        });
      }
    }
    return rows;
  });
}

export async function createWorkerRoute(
  _accountId: string,
  scriptName: string,
  zoneId: string,
  pattern: string,
): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.workers.routes.create({
      zone_id: zoneId,
      pattern,
      script: scriptName,
    });
  });
}

export async function deleteWorkerRoute(zoneId: string, routeId: string): Promise<void> {
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.workers.routes.delete(routeId, { zone_id: zoneId });
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
        verificationRecords: [],
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
    await cf.workers.scripts.secrets.delete(name, { account_id: accountId, script_name: scriptName });
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
    await cf.workers.scripts.tail.delete(session.tailId, {
      account_id: session.accountId,
      script_name: session.scriptName,
    });
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
  query?: { search?: string; type?: SupportedDnsRecordType | "all"; proxied?: boolean; page?: number },
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
  if (input.provider !== "cloudflare") throw new Error("This DNS record does not target Cloudflare.");
  return {
    type: input.type,
    name: input.name,
    content: input.data ? undefined : input.content,
    ttl: input.ttl,
    comment: input.comment,
    tags: input.tags,
    proxied: input.type === "A" || input.type === "AAAA" || input.type === "CNAME" ? input.proxied : undefined,
    priority: input.type === "MX" || input.type === "URI" ? input.priority : undefined,
    data: input.data,
    settings: input.settings,
  };
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

export async function batchDnsRecords(input: DnsBatchInput): Promise<void> {
  if (input.provider !== "cloudflare") throw new Error("Cloudflare batch DNS requires a Cloudflare zone.");
  await wrapProvider("cloudflare", async () => {
    const cf = await client();
    await cf.dns.records.batch({
      zone_id: input.zoneId,
      deletes: input.deletes?.map((id) => ({ id })),
      patches: input.patches?.map((item) => ({ id: item.id, ...recordBody(item.input) })) as never,
      puts: input.puts?.map((item) => ({ id: item.id, ...recordBody(item.input) })) as never,
      posts: input.posts?.map(recordBody) as never,
    });
  });
}

export async function importDnsRecords(
  zoneId: string,
  bind: string,
): Promise<{ added: number; parsed: number }> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    const response = await cf.dns.records.import({ zone_id: zoneId, file: bind });
    return { added: response.recs_added ?? 0, parsed: response.total_records_parsed ?? 0 };
  });
}

export async function exportDnsRecords(zoneId: string): Promise<string> {
  return wrapProvider("cloudflare", async () => {
    const cf = await client();
    return cf.dns.records.export({ zone_id: zoneId });
  });
}

export function pagesOpenUrl(url?: string): string | undefined {
  return url ? httpsUrl(url) : undefined;
}
