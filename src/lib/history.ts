import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HistoryChange, HistoryChangeStatus, HistoryFrame } from "@/types/world";

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_FRAMES = 60;
const MAX_CHANGES_PER_FRAME = 600;

export type HistoryOptions = {
  maxFrames?: number;
  maxChangesPerFrame?: number;
};

type RawCommit = {
  sha: string;
  authorName: string;
  authoredAt: string;
  message: string;
};

export async function analyzeRepositoryHistory(repoPath: string, options: HistoryOptions = {}): Promise<HistoryFrame[]> {
  const maxFrames = clampInt(options.maxFrames ?? DEFAULT_MAX_FRAMES, 2, 250);
  const maxChangesPerFrame = clampInt(options.maxChangesPerFrame ?? MAX_CHANGES_PER_FRAME, 25, 3_000);
  const commits = await listCommits(repoPath, maxFrames);

  const frames: HistoryFrame[] = [];
  for (let index = 0; index < commits.length; index += 1) {
    const commit = commits[index];
    const changes = await changesForCommit(repoPath, commit.sha, maxChangesPerFrame);
    frames.push({
      version: "1.0",
      kind: "history_frame",
      id: `history-${commit.sha.slice(0, 12)}`,
      sequence: index,
      commit: {
        sha: commit.sha,
        shortSha: commit.sha.slice(0, 7),
        message: commit.message,
        authorName: commit.authorName,
        authoredAt: commit.authoredAt
      },
      summary: summarizeChanges(changes.all, changes.truncated),
      changes: changes.visible
    });
  }

  return frames;
}

async function listCommits(repoPath: string, maxFrames: number): Promise<RawCommit[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", repoPath, "log", "--first-parent", `--max-count=${maxFrames}`, "--format=%H%x1f%an%x1f%aI%x1f%s"],
      { maxBuffer: 2 * 1024 * 1024 }
    );
    return stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [sha, authorName, authoredAt, ...messageParts] = line.split("\x1f");
        return {
          sha,
          authorName: authorName || "Unknown",
          authoredAt: authoredAt || "",
          message: messageParts.join("\x1f") || "Commit"
        };
      })
      .filter((commit) => commit.sha)
      .reverse();
  } catch {
    return [];
  }
}

async function changesForCommit(
  repoPath: string,
  sha: string,
  maxChangesPerFrame: number
): Promise<{ all: HistoryChange[]; visible: HistoryChange[]; truncated: boolean }> {
  const args = ["-C", repoPath, "diff-tree", "--root", "--no-commit-id", "--name-status", "--find-renames=20%", "-r", sha];
  const { stdout } = await execFileAsync("git", args, { maxBuffer: 6 * 1024 * 1024 });
  const all = stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseNameStatusLine)
    .filter((change): change is HistoryChange => Boolean(change));

  return {
    all,
    visible: all.slice(0, maxChangesPerFrame),
    truncated: all.length > maxChangesPerFrame
  };
}

function parseNameStatusLine(line: string): HistoryChange | null {
  const [rawStatus, firstPath, secondPath] = line.split("\t");
  if (!rawStatus || !firstPath) {
    return null;
  }

  const status = statusForGitCode(rawStatus);
  if (status === "renamed" || status === "copied") {
    return {
      status,
      previousPath: firstPath,
      path: secondPath ?? firstPath
    };
  }

  return {
    status,
    path: firstPath
  };
}

function statusForGitCode(code: string): HistoryChangeStatus {
  const prefix = code[0];
  switch (prefix) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "type_changed";
    default:
      return "unknown";
  }
}

function summarizeChanges(changes: HistoryChange[], truncated: boolean): HistoryFrame["summary"] {
  return {
    added: changes.filter((change) => change.status === "added").length,
    modified: changes.filter((change) => change.status === "modified" || change.status === "type_changed").length,
    deleted: changes.filter((change) => change.status === "deleted").length,
    renamed: changes.filter((change) => change.status === "renamed").length,
    copied: changes.filter((change) => change.status === "copied").length,
    total: changes.length,
    truncated
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
