import { Vercel } from "@vercel/sdk";
import type {
  ConnectionStatus,
  DeploymentLogEntry,
  DnsRecord,
  DnsZone,
  EnvironmentVariable,
  OperationResult,
  Paginated,
  ProjectCreateInput,
  ProjectPatchInput,
  SupportedDnsRecordType,
  UnifiedDeployment,
  UnifiedDomain,
  UnifiedProject,
  VercelDeploymentDetail,
} from "@shared/models";
import { httpsUrl } from "@shared/provider-types";
import { vercelState } from "@shared/status";
import { readToken } from "../credentials";
import { hashLocalSource, readLocalSourceFile, resolveLocalSource } from "../local-sources";
import { beginOperation, completeOperation, failOperation, updateOperation } from "../operations";
import { getPreferences } from "../preferences";
import type { CreateDeploymentInput, DnsRecordInput, DomainPatchInput, EnvVarInput } from "@shared/api-contract";
import { wrapProvider } from "./errors";
import {
  normalizeVercelBuildEvent,
  normalizeVercelDeployment,
  normalizeVercelDeploymentDetail,
  normalizeVercelDnsRecord,
  normalizeVercelDnsZone,
  normalizeVercelDomain,
  normalizeVercelEnv,
  normalizeVercelProject,
  normalizeVercelRuntimeLog,
  vercelAccount,
} from "./vercel-normalize";

let cached: { token: string; client: Vercel } | null = null;

async function client(): Promise<Vercel> {
  const token = await readToken("vercel");
  if (!token) {
    cached = null;
    throw new Error("Vercel is not connected.");
  }
  if (!cached || cached.token !== token) {
    cached = { token, client: new Vercel({ bearerToken: token }) };
  }
  return cached.client;
}

export function resetVercelClient(): void {
  cached = null;
}

export async function loadVercelScope(): Promise<{
  teamId?: string;
  teamName: string;
  teamSlug?: string;
  userName: string;
  userEmail?: string;
  userId?: string;
  teams: ConnectionStatus["vercel"]["teams"];
}> {
  const vercel = await client();
  const prefs = await getPreferences();
  const auth = await wrapProvider("vercel", () => vercel.user.getAuthUser());
  const user = auth?.user as { id?: string; name?: string; username?: string; email?: string } | undefined;
  const teamsResponse = await wrapProvider("vercel", () => vercel.teams.getTeams({ limit: 100 }));
  const teams = (teamsResponse.teams ?? []).map((team) => ({
    id: String((team as { id?: string }).id ?? ""),
    name: String((team as { name?: string }).name ?? (team as { slug?: string }).slug ?? ""),
    slug: String((team as { slug?: string }).slug ?? ""),
  }));
  const active = teams.find((team) => team.id === prefs.vercelTeamId);
  return {
    teamId: active?.id,
    teamName: active?.name ?? "Personal",
    teamSlug: active?.slug,
    userName: user?.name ?? user?.username ?? "Personal",
    userEmail: user?.email,
    userId: user?.id,
    teams,
  };
}

export async function connectVercel(token: string): Promise<ConnectionStatus["vercel"]> {
  const vercel = new Vercel({ bearerToken: token.trim() });
  const auth = await wrapProvider("vercel", () => vercel.user.getAuthUser());
  const user = auth?.user as { id?: string; name?: string; username?: string; email?: string } | undefined;
  const teamsResponse = await wrapProvider("vercel", () => vercel.teams.getTeams({ limit: 100 }));
  const teams = (teamsResponse.teams ?? []).map((team) => ({
    id: String((team as { id?: string }).id ?? ""),
    name: String((team as { name?: string }).name ?? (team as { slug?: string }).slug ?? ""),
    slug: String((team as { slug?: string }).slug ?? ""),
  }));
  cached = { token: token.trim(), client: vercel };
  return {
    connected: true,
    userName: user?.name ?? user?.username,
    userEmail: user?.email,
    userId: user?.id,
    teams,
    activeTeamId: null,
  };
}

export async function listVercelProjects(query?: string): Promise<UnifiedProject[]> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    const items: UnifiedProject[] = [];
    let from: string | undefined;
    for (let page = 0; page < 8; page += 1) {
      const response = (await vercel.projects.getProjects({
        teamId: scope.teamId,
        search: query,
        limit: "100",
        from,
      })) as unknown;
      const page = Array.isArray(response)
        ? { projects: response as Array<Record<string, unknown>>, next: undefined as number | undefined }
        : {
            projects: ((response as { projects?: Array<Record<string, unknown>> }).projects ?? []),
            next: (response as { pagination?: { next?: number | null } }).pagination?.next ?? undefined,
          };
      items.push(...page.projects.map((project) => normalizeVercelProject(project, account, scope.teamSlug)));
      if (!page.next || page.projects.length === 0) break;
      from = String(page.next);
    }
    return items;
  });
}

export async function getVercelProject(projectId: string): Promise<UnifiedProject> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    const project = (await vercel.projects.getProject({
      idOrName: projectId,
      teamId: scope.teamId,
    })) as unknown as Record<string, unknown>;
    return normalizeVercelProject(project, account, scope.teamSlug);
  });
}

export async function createVercelProject(input: ProjectCreateInput): Promise<UnifiedProject> {
  if (input.provider !== "vercel") throw new Error("Choose Vercel as the project provider.");
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    const git = input.source.kind === "git" ? input.source : undefined;
    if (git?.provider === "azure-devops") throw new Error("Vercel project import currently supports GitHub, GitLab, or Bitbucket repositories.");
    const created = await vercel.projects.createProject({
      teamId: scope.teamId,
      requestBody: {
        name: input.name,
        framework: input.framework as never,
        rootDirectory: input.rootDirectory ?? null,
        installCommand: input.installCommand ?? null,
        buildCommand: input.buildCommand ?? null,
        outputDirectory: input.outputDirectory ?? null,
        gitRepository: git ? { type: git.provider, repo: git.repository } as never : undefined,
      },
    });
    return normalizeVercelProject(created as unknown as Record<string, unknown>, account, scope.teamSlug);
  });
}

export async function updateVercelProject(projectId: string, patch: ProjectPatchInput): Promise<UnifiedProject> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    const updated = await vercel.projects.updateProject({
      idOrName: projectId,
      teamId: scope.teamId,
      requestBody: {
        name: patch.name,
        framework: patch.framework as never,
        rootDirectory: patch.rootDirectory ?? undefined,
        installCommand: patch.installCommand ?? undefined,
        buildCommand: patch.buildCommand ?? undefined,
        outputDirectory: patch.outputDirectory ?? undefined,
        previewDeploymentsDisabled:
          patch.previewDeployments === undefined ? undefined : patch.previewDeployments === "none",
      },
    });
    return normalizeVercelProject(updated as unknown as Record<string, unknown>, account, scope.teamSlug);
  });
}

export async function deleteVercelProject(projectId: string): Promise<void> {
  await wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    await vercel.projects.deleteProject({ idOrName: projectId, teamId: scope.teamId });
  });
}

export async function pauseVercelProject(projectId: string): Promise<void> {
  await wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    await vercel.projects.pauseProject({ projectId, teamId: scope.teamId });
  });
}

export async function resumeVercelProject(projectId: string): Promise<void> {
  await wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    await vercel.projects.unpauseProject({ projectId, teamId: scope.teamId });
  });
}

export async function listVercelDeployments(input: {
  projectId?: string;
  state?: string;
  environment?: string;
  branch?: string;
  query?: string;
  cursor?: string;
  limit?: number;
}): Promise<Paginated<UnifiedDeployment>> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    const mappedState =
      input.state && input.state !== "all" && input.state !== "unknown"
        ? {
            queued: "QUEUED,INITIALIZING",
            building: "BUILDING",
            ready: "READY",
            failed: "ERROR",
            canceled: "CANCELED",
          }[input.state]
        : undefined;
    const response = await vercel.deployments.getDeployments({
      teamId: scope.teamId,
      projectId: input.projectId,
      state: mappedState,
      target:
        input.environment && input.environment !== "all" && input.environment !== "unknown"
          ? input.environment
          : undefined,
      branch: input.branch,
      until: input.cursor ? Number(input.cursor) : undefined,
      limit: input.limit ?? 20,
    });
    const deployments = (response.deployments ?? []) as Array<Record<string, unknown>>;
    let items = deployments.map((deployment) => normalizeVercelDeployment(deployment, account));
    if (input.query) {
      const q = input.query.toLowerCase();
      items = items.filter((item) =>
        [item.projectName, item.url, item.branch, item.commitSha, item.commitMessage]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)),
      );
    }
    const last = deployments[deployments.length - 1];
    const nextCursor = last?.created ? String(last.created) : last?.createdAt ? String(last.createdAt) : undefined;
    return {
      items,
      nextCursor,
      hasMore: Boolean(response.pagination?.next) || deployments.length >= (input.limit ?? 20),
    };
  });
}

export async function createVercelDeployment(input: CreateDeploymentInput): Promise<OperationResult> {
  const project = await getVercelProject(input.projectId);
  const { operationId, signal } = beginOperation(`Preparing ${project.name} deployment`);
  try {
    const vercel = await client();
    const scope = await loadVercelScope();
    let requestBody: Record<string, unknown>;
    if (input.source.kind === "git") {
      const repository = splitVercelRepository(input.source.repository);
      const ref = input.source.ref ?? input.source.branch;
      const gitSource =
        input.source.provider === "github"
          ? { type: "github", org: repository.owner, repo: repository.name, ref, sha: input.source.commitSha }
          : input.source.provider === "gitlab"
            ? { type: "gitlab", projectId: input.source.repository, ref, sha: input.source.commitSha }
            : input.source.provider === "bitbucket"
              ? { type: "bitbucket", repoUuid: input.source.repository, ref, sha: input.source.commitSha }
              : undefined;
      if (!gitSource) throw new Error("Git deployments support GitHub, GitLab, or Bitbucket sources.");
      requestBody = {
        name: project.name,
        project: project.id,
        gitSource,
        target: input.target === "production" ? "production" : undefined,
      };
      updateOperation(operationId, { phase: "creating", label: `Deploying ${ref}` });
    } else {
      const source = resolveLocalSource(input.source.sourceId);
      if (source.entries.length > 15_000) throw new Error("Vercel source deployments support at most 15,000 files.");
      const entries = await hashLocalSource(
        input.source.sourceId,
        (completed, total, bytesCompleted, bytesTotal) =>
          updateOperation(operationId, {
            phase: "hashing",
            label: `Hashing files ${completed} of ${total}`,
            completed,
            total,
            bytesCompleted,
            bytesTotal,
          }),
        signal,
      );
      for (let index = 0; index < entries.length; index += 1) {
        if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Operation canceled.");
        const entry = entries[index]!;
        const contents = await readLocalSourceFile(input.source.sourceId, entry.relativePath);
        await wrapProvider("vercel", () =>
          vercel.deployments.uploadFile(
            {
              teamId: scope.teamId,
              contentLength: entry.size,
              xVercelDigest: entry.sha1,
              requestBody: new Uint8Array(contents),
            },
            { signal },
          ),
        );
        updateOperation(operationId, {
          phase: "uploading",
          label: `Uploading ${entry.relativePath}`,
          completed: index + 1,
          total: entries.length,
        });
      }
      requestBody = {
        name: project.name,
        project: project.id,
        files: entries.map((entry) => ({ file: entry.relativePath, sha: entry.sha1, size: entry.size })),
        target: input.target === "production" ? "production" : undefined,
        projectSettings: {
          framework: project.framework,
          rootDirectory: project.rootDirectory,
          installCommand: project.installCommand,
          buildCommand: project.buildCommand,
          outputDirectory: project.outputDirectory,
        },
      };
      updateOperation(operationId, { phase: "creating", label: "Creating Vercel deployment" });
    }

    const created = await wrapProvider("vercel", () =>
      vercel.deployments.createDeployment(
        {
          teamId: scope.teamId,
          forceNew: input.force ? "1" : undefined,
          requestBody: requestBody as never,
        },
        { signal },
      ),
    );
    const id = String((created as { id?: string; uid?: string }).id ?? (created as { uid?: string }).uid ?? "");
    const url = (created as { url?: string }).url;
    completeOperation(operationId, "Vercel deployment created");
    return {
      operationId,
      provider: "vercel",
      resourceKind: "deployment",
      resourceId: id,
      resourceName: project.name,
      dashboardUrl: url ? httpsUrl(url) : undefined,
    };
  } catch (error) {
    failOperation(operationId, error instanceof Error ? error.message : "Vercel deployment failed");
    throw error;
  }
}

function splitVercelRepository(repository: string): { owner: string; name: string } {
  const normalized = repository
    .trim()
    .replace(/^git@[^:]+:/, "")
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "");
  const parts = normalized.split("/").filter(Boolean);
  return { owner: parts.at(-2) ?? "", name: parts.at(-1) ?? normalized };
}

export async function getVercelDeployment(id: string): Promise<VercelDeploymentDetail> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    const deployment = (await vercel.deployments.getDeployment({
      idOrUrl: id,
      teamId: scope.teamId,
    })) as unknown as Record<string, unknown>;
    let aliases: string[] = [];
    try {
      const listed = await vercel.aliases.listDeploymentAliases({
        id,
        teamId: scope.teamId,
      });
      aliases = ((listed.aliases ?? []) as Array<{ alias?: string }>).map((item) => item.alias).filter((item): item is string => Boolean(item));
    } catch {
      aliases = Array.isArray(deployment.alias) ? (deployment.alias as string[]) : [];
    }
    return normalizeVercelDeploymentDetail(deployment, account, scope.teamSlug, aliases);
  });
}

export async function getVercelBuildLogs(id: string): Promise<DeploymentLogEntry[]> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const events = await vercel.deployments.getDeploymentEvents({
      idOrUrl: id,
      teamId: scope.teamId,
      direction: "forward",
      limit: 2000,
      builds: 1,
    } as never);
    const rows = Array.isArray(events) ? events : ((events as { events?: unknown[] }).events ?? []);
    return (rows as Array<Record<string, unknown>>).map((event, index) => normalizeVercelBuildEvent(event, index));
  });
}

export async function getVercelRuntimeLogs(
  projectId: string,
  deploymentId: string,
): Promise<DeploymentLogEntry[] | { unavailable: string }> {
  try {
    const vercel = await client();
    const scope = await loadVercelScope();
    const result = await vercel.logs.getRuntimeLogs({
      projectId,
      deploymentId,
      teamId: scope.teamId,
    });
    const rows = Array.isArray(result) ? result : result ? [result] : [];
    if (rows.length === 0) {
      return [];
    }
    return (rows as Array<Record<string, unknown>>).map((row, index) => normalizeVercelRuntimeLog(row, index));
  } catch (error) {
    const status = (error as { statusCode?: number; status?: number }).statusCode ?? (error as { status?: number }).status;
    if (status === 403 || status === 402 || status === 404 || status === 400) {
      return {
        unavailable: "Vercel runtime logs are unavailable for this deployment or account plan.",
      };
    }
    return wrapProvider("vercel", async () => {
      throw error;
    });
  }
}

export async function cancelVercelDeployment(id: string): Promise<void> {
  await wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    await vercel.deployments.cancelDeployment({ id, teamId: scope.teamId } as never);
  });
}

export async function redeployVercelDeployment(id: string, target?: "production" | "preview"): Promise<UnifiedDeployment> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const existing = await getVercelDeployment(id);
    const created = (await vercel.deployments.createDeployment({
      teamId: scope.teamId,
      forceNew: "1" as never,
      requestBody: {
        name: existing.projectName,
        deploymentId: id,
        target,
        project: existing.projectId,
      },
    })) as unknown as Record<string, unknown>;
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    return normalizeVercelDeployment(created, account, existing.projectName);
  });
}

export async function promoteVercelDeployment(id: string, projectId: string): Promise<void> {
  await wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    await vercel.projects.requestPromote({
      projectId,
      deploymentId: id,
      teamId: scope.teamId,
    });
  });
}

export async function rollbackVercelDeployment(id: string, projectId: string): Promise<void> {
  await wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    await vercel.projects.requestRollback({
      projectId,
      deploymentId: id,
      teamId: scope.teamId,
    });
  });
}

export async function deleteVercelDeployment(id: string): Promise<void> {
  await wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    await vercel.deployments.deleteDeployment({ id, teamId: scope.teamId });
  });
}

export async function listVercelDomains(projectId: string): Promise<UnifiedDomain[]> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    const project = await getVercelProject(projectId);
    const response = await vercel.projects.getProjectDomains({
      idOrName: projectId,
      teamId: scope.teamId,
    });
    const domains = (response.domains ?? []) as Array<Record<string, unknown>>;
    return domains.map((domain) => normalizeVercelDomain(domain, project, account));
  });
}

export async function addVercelDomain(projectId: string, name: string): Promise<UnifiedDomain> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    const project = await getVercelProject(projectId);
    const created = (await vercel.projects.addProjectDomain({
      idOrName: projectId,
      teamId: scope.teamId,
      requestBody: { name },
    })) as unknown as Record<string, unknown>;
    return normalizeVercelDomain(created, project, account);
  });
}

export async function updateVercelDomain(
  projectId: string,
  name: string,
  patch: DomainPatchInput,
): Promise<UnifiedDomain> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    const project = await getVercelProject(projectId);
    const updated = await vercel.projects.updateProjectDomain({
      idOrName: projectId,
      domain: name,
      teamId: scope.teamId,
      requestBody: {
        redirect: patch.redirect,
        redirectStatusCode: patch.redirectStatusCode,
        gitBranch: patch.gitBranch,
        customEnvironmentId: patch.customEnvironmentId,
      } as never,
    });
    return normalizeVercelDomain(updated as unknown as Record<string, unknown>, project, account);
  });
}

export async function moveVercelDomain(
  projectId: string,
  name: string,
  targetProjectId: string,
): Promise<UnifiedDomain> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    const target = await getVercelProject(targetProjectId);
    const moved = await vercel.projects.moveProjectDomain({
      idOrName: projectId,
      domain: name,
      teamId: scope.teamId,
      requestBody: { projectId: targetProjectId },
    });
    return normalizeVercelDomain(moved as unknown as Record<string, unknown>, target, account);
  });
}

export async function removeVercelDomain(projectId: string, name: string): Promise<void> {
  await wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    await vercel.projects.removeProjectDomain({
      idOrName: projectId,
      domain: name,
      teamId: scope.teamId,
    });
  });
}

export async function verifyVercelDomain(projectId: string, name: string): Promise<UnifiedDomain> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    const project = await getVercelProject(projectId);
    const verified = (await vercel.projects.verifyProjectDomain({
      idOrName: projectId,
      domain: name,
      teamId: scope.teamId,
    })) as unknown as Record<string, unknown>;
    return normalizeVercelDomain(verified, project, account);
  });
}

export async function listVercelEnvVars(projectId: string): Promise<EnvironmentVariable[]> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const project = await getVercelProject(projectId);
    const response = await vercel.projects.filterProjectEnvs({
      idOrName: projectId,
      teamId: scope.teamId,
    });
    const envs = (Array.isArray(response) ? response : (response as { envs?: unknown[] }).envs ?? []) as Array<Record<string, unknown>>;
    return envs.map((env) => normalizeVercelEnv(env, project, scope.teamId ?? "personal"));
  });
}

function envType(input: EnvVarInput): "plain" | "encrypted" | "sensitive" {
  if (input.type === "plain") return "plain";
  if (input.type === "sensitive") return "sensitive";
  return "encrypted";
}

export async function createVercelEnvVar(projectId: string, input: EnvVarInput): Promise<void> {
  await wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    await vercel.projects.createProjectEnv({
      idOrName: projectId,
      teamId: scope.teamId,
      upsert: "true",
      requestBody: {
        key: input.key,
        value: input.value,
        type: envType(input),
        target: input.targets as Array<"production" | "preview" | "development">,
        gitBranch: input.branch,
        comment: input.comment,
      },
    });
  });
}

export async function updateVercelEnvVar(projectId: string, envId: string, input: EnvVarInput): Promise<void> {
  await wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    await vercel.projects.editProjectEnv({
      idOrName: projectId,
      id: envId,
      teamId: scope.teamId,
      requestBody: {
        key: input.key,
        value: input.value,
        type: envType(input),
        target: input.targets as Array<"production" | "preview" | "development">,
        gitBranch: input.branch,
        comment: input.comment,
      },
    });
  });
}

export async function deleteVercelEnvVar(projectId: string, envId: string): Promise<void> {
  await wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    await vercel.projects.removeProjectEnv({
      idOrName: projectId,
      id: envId,
      teamId: scope.teamId,
    });
  });
}

export async function revealVercelEnvVar(projectId: string, envId: string): Promise<string> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const env = (await vercel.projects.getProjectEnv({
      idOrName: projectId,
      id: envId,
      teamId: scope.teamId,
    })) as { value?: string };
    return env.value ?? "";
  });
}

export async function listVercelDnsZones(): Promise<DnsZone[]> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
    const response = await vercel.domains.getDomains({ teamId: scope.teamId, limit: 100 });
    return response.domains
      .filter((domain) => domain.serviceType === "zeit.world")
      .map((domain) => normalizeVercelDnsZone(domain as unknown as Record<string, unknown>, account));
  });
}

export async function listVercelDnsRecords(
  zoneId: string,
  query?: { search?: string; type?: SupportedDnsRecordType | "all"; page?: number },
): Promise<Paginated<DnsRecord>> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const response = await vercel.dns.getRecords({ domain: zoneId, teamId: scope.teamId, limit: "100" });
    if (typeof response === "string") return { items: [], hasMore: false };
    const rows = (response.records ?? []) as Array<Record<string, unknown>>;
    let items = rows.map((record) => normalizeVercelDnsRecord(record, { id: zoneId, name: zoneId }));
    if (query?.type && query.type !== "all") items = items.filter((item) => item.type === query.type);
    if (query?.search) {
      const value = query.search.toLowerCase();
      items = items.filter((item) => `${item.name} ${item.content}`.toLowerCase().includes(value));
    }
    return { items, hasMore: false };
  });
}

function vercelDnsName(name: string, zoneName: string): string {
  const normalized = name.replace(/\.$/, "").toLowerCase();
  const zone = zoneName.replace(/\.$/, "").toLowerCase();
  if (!normalized || normalized === "@" || normalized === zone) return "@";
  return normalized.endsWith(`.${zone}`) ? normalized.slice(0, -(zone.length + 1)) : normalized;
}

function vercelDnsBody(input: DnsRecordInput): Record<string, unknown> {
  if (input.provider !== "vercel") throw new Error("This DNS record does not target Vercel.");
  const body: Record<string, unknown> = {
    name: vercelDnsName(input.name, input.zoneId),
    type: input.type,
    ttl: input.ttl === 1 ? 60 : input.ttl,
    value: input.content,
    comment: input.comment,
  };
  if (input.type === "MX") body.mxPriority = input.priority ?? 10;
  if (input.type === "SRV") {
    body.srv = {
      priority: Number(input.data?.priority ?? input.priority ?? 10),
      weight: Number(input.data?.weight ?? 10),
      port: Number(input.data?.port ?? 443),
      target: String(input.data?.target ?? input.content),
    };
  }
  if (input.type === "HTTPS") {
    body.https = {
      priority: Number(input.data?.priority ?? 1),
      target: String(input.data?.target ?? "."),
      params: String(input.data?.value ?? ""),
    };
  }
  if (input.type === "CAA" && input.data) {
    body.value = `${input.data.flags ?? 0} ${input.data.tag ?? "issue"} "${input.data.value ?? input.content}"`;
  }
  return body;
}

export async function createVercelDnsRecord(input: DnsRecordInput): Promise<DnsRecord> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const created = await vercel.dns.createRecord({
      domain: input.zoneId,
      teamId: scope.teamId,
      requestBody: vercelDnsBody(input) as never,
    });
    const id = String((created as { uid?: string }).uid ?? "");
    const records = await listVercelDnsRecords(input.zoneId);
    return (
      records.items.find((record) => record.id === id) ?? {
        id,
        provider: "vercel",
        zoneId: input.zoneId,
        zoneName: input.zoneId,
        type: input.type,
        name: input.name,
        content: input.content,
        ttl: input.ttl === 1 ? 60 : input.ttl,
        priority: input.priority,
        comment: input.comment,
        tags: [],
        data: input.data,
      }
    );
  });
}

export async function updateVercelDnsRecord(recordId: string, input: DnsRecordInput): Promise<DnsRecord> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const updated = await vercel.dns.updateRecord({
      recordId,
      teamId: scope.teamId,
      requestBody: vercelDnsBody(input) as never,
    });
    return normalizeVercelDnsRecord(updated as unknown as Record<string, unknown>, {
      id: input.zoneId,
      name: input.zoneId,
    });
  });
}

export async function deleteVercelDnsRecord(zoneId: string, recordId: string): Promise<void> {
  await wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    await vercel.dns.removeRecord({ domain: zoneId, recordId, teamId: scope.teamId });
  });
}

export function vercelDeploymentDashboardUrl(detail: VercelDeploymentDetail): string {
  return detail.dashboardUrl;
}

export function vercelOpenUrl(url?: string): string | undefined {
  return url ? httpsUrl(url) : undefined;
}

export { vercelState };
