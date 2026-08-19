import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { hashScannedEntries, isSafeRelativeSourcePath, localSourceFileLimit, scanLocalSourcePath } from "../main/local-source-scan";

describe("local source scanner", () => {
  it("honors built-in patterns and .gitignore without following symlinks", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "deploydeck-source-"));
    try {
      await mkdir(path.join(root, "src"));
      await mkdir(path.join(root, "node_modules"));
      await writeFile(path.join(root, "src", "index.ts"), "export default {}", "utf8");
      await writeFile(path.join(root, "node_modules", "ignored.js"), "ignored", "utf8");
      await writeFile(path.join(root, "secret.env"), "SECRET=value", "utf8");
      await writeFile(path.join(root, ".gitignore"), "secret.env\n", "utf8");
      await symlink(path.join(root, "src", "index.ts"), path.join(root, "linked.ts"));
      const result = await scanLocalSourcePath(root, ["node_modules"]);
      assert.deepEqual(result.entries.map((entry) => entry.relativePath), [".gitignore", "src/index.ts"]);
      assert.ok(result.ignoredCount >= 2);
      assert.equal(result.symlinkCount, 1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("hashes safe relative paths, reports progress, and rejects traversal", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "deploydeck-hash-"));
    try {
      const file = path.join(root, "index.js");
      await writeFile(file, "hello", "utf8");
      const progress: number[] = [];
      const hashed = await hashScannedEntries(
        [{ relativePath: "src/index.js", absolutePath: file, size: 5 }],
        (completed) => progress.push(completed),
      );
      assert.equal(hashed[0]?.sha1, "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
      assert.deepEqual(progress, [1]);
      await assert.rejects(
        hashScannedEntries([{ relativePath: "../secret", absolutePath: file, size: 5 }]),
        /Unsafe local source path/,
      );
      assert.equal(isSafeRelativeSourcePath("src/index.ts"), true);
      assert.equal(isSafeRelativeSourcePath("src/../../secret"), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses provider file limits and stops hashing when canceled", async () => {
    assert.equal(localSourceFileLimit("pages-output"), 20_000);
    assert.equal(localSourceFileLimit("source"), 15_000);
    const controller = new AbortController();
    controller.abort(new Error("fixture canceled"));
    await assert.rejects(hashScannedEntries([], undefined, controller.signal), /fixture canceled/);
  });
});
