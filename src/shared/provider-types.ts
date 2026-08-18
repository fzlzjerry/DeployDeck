export const VERCEL_TOKEN_URL = "https://vercel.com/account/tokens";
export const CLOUDFLARE_TOKEN_URL =
  "https://dash.cloudflare.com/profile/api-tokens";
export const VERCEL_DOCS_URL = "https://vercel.com/docs";
export const CLOUDFLARE_DOCS_URL = "https://developers.cloudflare.com/";

export const VERCEL_DASHBOARD = "https://vercel.com";
export const CLOUDFLARE_DASHBOARD = "https://dash.cloudflare.com";

export function vercelProjectUrl(teamSlug: string | undefined, projectName: string): string {
  return teamSlug
    ? `${VERCEL_DASHBOARD}/${teamSlug}/${projectName}`
    : `${VERCEL_DASHBOARD}/${projectName}`;
}

export function vercelDeploymentUrl(
  teamSlug: string | undefined,
  projectName: string,
  deploymentId: string,
): string {
  const base = vercelProjectUrl(teamSlug, projectName);
  return `${base}/${deploymentId}`;
}

export function cloudflarePagesUrl(accountId: string, projectName: string): string {
  return `${CLOUDFLARE_DASHBOARD}/${accountId}/pages/view/${projectName}`;
}

export function cloudflarePagesDeploymentUrl(
  accountId: string,
  projectName: string,
  deploymentId: string,
): string {
  return `${CLOUDFLARE_DASHBOARD}/${accountId}/pages/view/${projectName}/${deploymentId}`;
}

export function cloudflareWorkerUrl(accountId: string, scriptName: string): string {
  return `${CLOUDFLARE_DASHBOARD}/${accountId}/workers/services/view/${scriptName}`;
}

export function httpsUrl(hostOrUrl: string): string {
  if (hostOrUrl.startsWith("https://") || hostOrUrl.startsWith("http://")) {
    return hostOrUrl.replace(/^http:\/\//, "https://");
  }
  return `https://${hostOrUrl}`;
}

export function gitRepositoryUrl(repo?: string | { type?: string; repo?: string; owner?: string; name?: string; slug?: string }): string | undefined {
  if (!repo) return undefined;
  if (typeof repo === "string") {
    if (repo.startsWith("https://") || repo.startsWith("http://")) return repo.replace(/^http:\/\//, "https://");
    if (repo.includes("/")) return `https://github.com/${repo}`;
    return undefined;
  }
  if (repo.slug) {
    return repo.slug.startsWith("http") ? repo.slug : `https://github.com/${repo.slug}`;
  }
  if (repo.repo && repo.repo.includes("/")) {
    return `https://github.com/${repo.repo}`;
  }
  if (repo.owner && repo.name) {
    return `https://github.com/${repo.owner}/${repo.name}`;
  }
  return undefined;
}
