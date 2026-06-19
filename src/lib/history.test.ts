import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeRepositoryHistory } from "@/lib/history";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

describe("history analyzer", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it("extracts deterministic commit frames and file changes", async () => {
    const repoPath = await makeGitRepo();

    await fs.writeFile(path.join(repoPath, "README.md"), "# Demo\n", "utf8");
    await git(repoPath, ["add", "README.md"]);
    await commit(repoPath, "Initial commit");

    await fs.mkdir(path.join(repoPath, "src"));
    await fs.writeFile(path.join(repoPath, "src/app.ts"), "export const app = true;\n", "utf8");
    await git(repoPath, ["add", "src/app.ts"]);
    await commit(repoPath, "Add app");

    await git(repoPath, ["mv", "src/app.ts", "src/main.ts"]);
    await fs.writeFile(path.join(repoPath, "src/main.ts"), "export const app = true;\nexport const version = 1;\n", "utf8");
    await git(repoPath, ["add", "src/main.ts"]);
    await commit(repoPath, "Rename app entry");

    const frames = await analyzeRepositoryHistory(repoPath, { maxFrames: 10 });

    expect(frames).toHaveLength(3);
    expect(frames.map((frame) => frame.sequence)).toEqual([0, 1, 2]);
    expect(frames[0].summary.added).toBe(1);
    expect(frames[1].changes).toEqual([expect.objectContaining({ status: "added", path: "src/app.ts" })]);
    expect(frames[2].changes).toEqual([
      expect.objectContaining({
        status: "renamed",
        previousPath: "src/app.ts",
        path: "src/main.ts"
      })
    ]);
  });
});

async function makeGitRepo(): Promise<string> {
  const repoPath = await fs.mkdtemp(path.join(os.tmpdir(), "repobricks-history-"));
  tempDirs.push(repoPath);
  await git(repoPath, ["init"]);
  return repoPath;
}

async function git(repoPath: string, args: string[]) {
  await execFileAsync("git", ["-C", repoPath, ...args], { maxBuffer: 1024 * 1024 });
}

async function commit(repoPath: string, message: string) {
  await execFileAsync(
    "git",
    ["-C", repoPath, "-c", "user.name=RepoBricks Test", "-c", "user.email=test@repobricks.local", "commit", "-m", message],
    { maxBuffer: 1024 * 1024 }
  );
}
