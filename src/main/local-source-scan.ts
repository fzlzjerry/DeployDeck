import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import ignore, { type Ignore } from "ignore";

export interface ScannedLocalEntry {
  relativePath: string;
  absolutePath: string;
  size: number;
}

export interface HashedLocalEntry extends ScannedLocalEntry {
  sha1: string;
}

export function localSourceFileLimit(kind: "source" | "pages-output" | "worker-entry" | "worker-project" | "worker-bundle"): number {
  return kind === "pages-output" ? 20_000 : 15_000;
}

export function isSafeRelativeSourcePath(value: string): boolean {
  const normalized = value.replaceAll("\\", "/");
  return Boolean(normalized && !normalized.startsWith("/") && normalized !== ".." && !normalized.startsWith("../") && !normalized.split("/").includes(".."));
}

export async function hashScannedEntries(
  entries: ScannedLocalEntry[],
  onProgress?: (completed: number, total: number, bytesCompleted: number, bytesTotal: number) => void,
  signal?: AbortSignal,
): Promise<HashedLocalEntry[]> {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Operation canceled.");
  const bytesTotal = entries.reduce((sum, entry) => sum + entry.size, 0);
  let bytesCompleted = 0;
  const output: HashedLocalEntry[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Operation canceled.");
    const entry = entries[index]!;
    if (!isSafeRelativeSourcePath(entry.relativePath)) throw new Error(`Unsafe local source path: ${entry.relativePath}`);
    const contents = await readFile(entry.absolutePath);
    bytesCompleted += entry.size;
    output.push({ ...entry, sha1: createHash("sha1").update(contents).digest("hex") });
    onProgress?.(index + 1, entries.length, bytesCompleted, bytesTotal);
  }
  return output;
}

export async function createLocalSourceMatcher(rootPath: string, preferencePatterns: string[]): Promise<Ignore> {
  const matcher = ignore();
  matcher.add(preferencePatterns.flatMap((pattern) => [pattern, `${pattern}/`, `**/${pattern}/**`]));
  try {
    const gitignore = await readFile(path.join(rootPath, ".gitignore"), "utf8");
    matcher.add(gitignore.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#")));
  } catch {
    // A source folder does not need to be a Git repository.
  }
  return matcher;
}

export async function scanLocalDirectory(
  rootPath: string,
  matcher: Ignore,
): Promise<{ entries: ScannedLocalEntry[]; ignoredCount: number; symlinkCount: number }> {
  const entries: ScannedLocalEntry[] = [];
  let ignoredCount = 0;
  let symlinkCount = 0;
  const visit = async (directory: string) => {
    const children = await readdir(directory, { withFileTypes: true });
    for (const child of children) {
      const absolutePath = path.join(directory, child.name);
      const relativePath = path.relative(rootPath, absolutePath).split(path.sep).join("/");
      if (!isSafeRelativeSourcePath(relativePath)) continue;
      if (matcher.ignores(relativePath) || matcher.ignores(`${relativePath}/`)) {
        ignoredCount += 1;
        continue;
      }
      if (child.isSymbolicLink()) {
        symlinkCount += 1;
        continue;
      }
      if (child.isDirectory()) await visit(absolutePath);
      else if (child.isFile()) {
        const info = await stat(absolutePath);
        entries.push({ relativePath, absolutePath, size: info.size });
      }
    }
  };
  await visit(rootPath);
  entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return { entries, ignoredCount, symlinkCount };
}

export async function scanLocalSourcePath(rootPath: string, patterns: string[] = []) {
  return scanLocalDirectory(rootPath, await createLocalSourceMatcher(rootPath, patterns));
}
