import { Vercel } from "@vercel/sdk";
import type {
  ConnectionStatus,
  DeploymentLogEntry,
  EnvironmentVariable,
  Paginated,
  UnifiedDeployment,
  UnifiedDomain,
  UnifiedProject,
  VercelDeploymentDetail,
} from "@shared/models";
import { httpsUrl } from "@shared/provider-types";
import { vercelState } from "@shared/status";
import { readToken } from "../credentials";
import { getPreferences } from "../preferences";
import type { EnvVarInput } from "@shared/api-contract";
import { wrapProvider } from "./errors";
import {
  normalizeVercelBuildEvent,
  normalizeVercelDeployment,
  normalizeVercelDeploymentDetail,
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

export async function deployVercelLatest(
  projectId: string,
  target: "production" | "preview" = "production",
): Promise<UnifiedDeployment> {
  return wrapProvider("vercel", async () => {
    const vercel = await client();
    const scope = await loadVercelScope();
    const project = await getVercelProject(projectId);
    try {
      const created = (await vercel.deployments.createDeployment({
        teamId: scope.teamId,
        requestBody: {
          name: project.name,
          project: projectId,
          target,
        },
      })) as unknown as Record<string, unknown>;
      const account = vercelAccount(scope.teamId ?? null, scope.teamName, scope.userName);
      return normalizeVercelDeployment(created, account, project.name);
    } catch {
      const latest = await listVercelDeployments({ projectId, environment: target, limit: 1 });
      const source = latest.items[0] ?? (await listVercelDeployments({ projectId, limit: 1 })).items[0];
      if (!source) {
        throw new Error("No existing deployment is available to redeploy.");
      }
      return redeployVercelDeployment(source.id, target);
    }
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

export function vercelDeploymentDashboardUrl(detail: VercelDeploymentDetail): string {
  return detail.dashboardUrl;
}

export function vercelOpenUrl(url?: string): string | undefined {
  return url ? httpsUrl(url) : undefined;
}

export { vercelState };
