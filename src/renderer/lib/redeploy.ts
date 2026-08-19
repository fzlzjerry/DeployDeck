import type { UnifiedProject } from "@shared/models";

export async function redeployProduction(project: Pick<UnifiedProject, "provider" | "id" | "name" | "accountId">): Promise<void> {
  if (project.provider === "vercel") {
    const listed = await window.deployDeck.vercel.listDeployments({
      projectId: project.id,
      environment: "production",
      limit: 10,
    });
    const source = listed.items.find((item) => item.state === "ready") ?? listed.items[0];
    if (!source) throw new Error("No production deployment is available to redeploy.");
    await window.deployDeck.vercel.redeploy(source.id, "production");
    return;
  }

  if (project.provider === "cloudflare-pages") {
    const listed = await window.deployDeck.cloudflare.listPagesDeployments({
      accountId: project.accountId,
      projectName: project.name,
      environment: "production",
      limit: 10,
    });
    const source = listed.items.find((item) => item.state === "ready") ?? listed.items[0];
    if (!source) throw new Error("No production deployment is available to retry.");
    await window.deployDeck.cloudflare.retryPagesDeployment(project.accountId, project.name, source.id);
    return;
  }

  throw new Error("Workers are deployed from a version, not from a production branch.");
}

export function envChangeNeedsRedeploy(provider: UnifiedProject["provider"] | "cloudflare-workers"): boolean {
  return provider === "vercel" || provider === "cloudflare-pages";
}
