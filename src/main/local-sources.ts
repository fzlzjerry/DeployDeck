import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { dialog } from "electron";
import { parse as parseJsonc } from "jsonc-parser";
import { parse as parseToml } from "smol-toml";
import type { LocalSourceHandle } from "@shared/models";
import { getPreferences } from "./preferences";
import { createLocalSourceMatcher, hashScannedEntries, localSourceFileLimit, scanLocalDirectory } from "./local-source-scan";

const SOURCE_TTL_MS = 30 * 60 * 1000;

export interface LocalSourceEntry {
  relativePath: string;
  absolutePath: string;
  size: number;
  sha1?: string;
}

interface StoredLocalSource {
  handle: LocalSourceHandle;
  rootPath: string;
  entries: LocalSourceEntry[];
}

const sources = new Map<string, StoredLocalSource>();

export async function selectLocalSource(kind: LocalSourceHandle["kind"]): Promise<LocalSourceHandle | null> {
  pruneSources();
  const file = kind === "worker-entry" || kind === "worker-bundle";
  const result = await dialog.showOpenDialog({
    title: sourceTitle(kind),
    buttonLabel: file ? "Choose file" : "Choose folder",
    properties: file ? ["openFile"] : ["openDirectory"],
    filters: file
      ? [{ name: "Worker source", extensions: kind === "worker-bundle" ? ["js", "mjs"] : ["ts", "tsx", "js", "jsx", "mjs"] }]
      : undefined,
  });
  const selected = result.filePaths[0];
  if (result.canceled || !selected) return null;

  const selectedStat = await stat(selected);
  const rootPath = selectedStat.isDirectory() ? selected : path.dirname(selected);
  const preferences = await getPreferences();
  const matcher = await createLocalSourceMatcher(rootPath, preferences.localUploadIgnore);
  const scan = selectedStat.isDirectory()
    ? await scanLocalDirectory(rootPath, matcher)
    : { entries: [{ relativePath: path.basename(selected), absolutePath: selected, size: selectedStat.size }], ignoredCount: 0, symlinkCount: 0 };
  const totalBytes = scan.entries.reduce((sum, entry) => sum + entry.size, 0);
  const detected = await detectProject(rootPath, selectedStat.isFile() ? selected : undefined);
  const warnings: string[] = [];
  const limit = localSourceFileLimit(kind);
  if (scan.entries.length > limit) warnings.push(`${scan.entries.length.toLocaleString()} files exceeds the ${limit.toLocaleString()} file upload limit.`);
  if (scan.symlinkCount) warnings.push(`${scan.symlinkCount} symbolic link${scan.symlinkCount === 1 ? " was" : "s were"} ignored.`);
  if (totalBytes > 100 * 1024 * 1024) warnings.push(`${formatBytes(totalBytes)} will take longer to hash and upload.`);
  if (scan.entries.length === 0) warnings.push("No uploadable files were found.");

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SOURCE_TTL_MS).toISOString();
  const handle: LocalSourceHandle = {
    id,
    kind,
    name: path.basename(selected),
    fileCount: scan.entries.length,
    totalBytes,
    ignoredCount: scan.ignoredCount,
    expiresAt,
    detected,
    warnings,
  };
  sources.set(id, { handle, rootPath, entries: scan.entries });
  return handle;
}

export function releaseLocalSource(sourceId: string): void {
  sources.delete(sourceId);
}

export function resolveLocalSource(sourceId: string): StoredLocalSource {
  pruneSources();
  const source = sources.get(sourceId);
  if (!source) throw new Error("The selected local source expired. Choose it again.");
  return source;
}

export async function hashLocalSource(
  sourceId: string,
  onProgress?: (completed: number, total: number, bytesCompleted: number, bytesTotal: number) => void,
  signal?: AbortSignal,
): Promise<LocalSourceEntry[]> {
  const source = resolveLocalSource(sourceId);
  return hashScannedEntries(source.entries, onProgress, signal);
}

export async function readLocalSourceFile(sourceId: string, relativePath: string): Promise<Buffer> {
  const source = resolveLocalSource(sourceId);
  const entry = source.entries.find((item) => item.relativePath === relativePath);
  if (!entry) throw new Error(`Local source file not found: ${relativePath}`);
  return readFile(entry.absolutePath);
}

export function localSourceRoot(sourceId: string): string {
  return resolveLocalSource(sourceId).rootPath;
}

/** Pure scanner entrypoint used by the fixture suite; it never opens a dialog. */
function sourceTitle(kind: LocalSourceHandle["kind"]): string {
  if (kind === "pages-output") return "Choose a prebuilt Pages output folder";
  if (kind === "worker-entry") return "Choose a Worker entry file";
  if (kind === "worker-project") return "Choose a Worker project folder";
  if (kind === "worker-bundle") return "Choose a prebuilt Worker bundle";
  return "Choose a source folder";
}

async function detectProject(rootPath: string, selectedFile?: string): Promise<LocalSourceHandle["detected"]> {
  const detected: NonNullable<LocalSourceHandle["detected"]> = {};
  if (selectedFile) detected.entrypoint = path.basename(selectedFile);
  try {
    const packageJson = JSON.parse(await readFile(path.join(rootPath, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const packages = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (packages.next) detected.framework = "nextjs";
    else if (packages.astro) detected.framework = "astro";
    else if (packages["@remix-run/react"]) detected.framework = "remix";
    else if (packages.vite) detected.framework = "vite";
    if (detected.framework === "nextjs") detected.outputDirectory = ".next";
    else if (detected.framework) detected.outputDirectory = "dist";
  } catch {
    // Non-Node projects are still valid local uploads.
  }
  detected.repository = await detectRepository(rootPath);
  const wrangler = await detectWrangler(rootPath);
  if (wrangler.entrypoint) detected.entrypoint = wrangler.entrypoint;
  return Object.keys(detected).length ? detected : undefined;
}

async function detectRepository(rootPath: string): Promise<string | undefined> {
  try {
    const config = await readFile(path.join(rootPath, ".git", "config"), "utf8");
    const match = config.match(/\[remote\s+"origin"\][\s\S]*?url\s*=\s*([^\r\n]+)/);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

async function detectWrangler(rootPath: string): Promise<{ entrypoint?: string }> {
  for (const file of ["wrangler.jsonc", "wrangler.json", "wrangler.toml"]) {
    try {
      const contents = await readFile(path.join(rootPath, file), "utf8");
      const value = file.endsWith("toml") ? parseToml(contents) : parseJsonc(contents);
      if (typeof value === "object" && value !== null) {
        const main = (value as Record<string, unknown>).main;
        if (typeof main === "string") return { entrypoint: main };
      }
    } catch {
      // Try the next supported Wrangler config format.
    }
  }
  return {};
}

function pruneSources(): void {
  const now = Date.now();
  for (const [id, source] of sources) {
    if (Date.parse(source.handle.expiresAt) <= now) sources.delete(id);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
