import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AnalysisArtifacts, AnalysisJob, AnalyzeRequest } from "@/types/world";
import { InvalidRepoUrlError, parseGitHubUrl } from "@/lib/github";
import { analyzeGitHubRepositoryArtifacts, RepoTooLargeError, RepoUnavailableError } from "@/lib/analyzer";

const JOB_ROOT = process.env.REPOBRICKS_JOB_ROOT ?? path.join(os.tmpdir(), "repobricks-jobs");
const MAX_RENDERED_FILES = 10_000;
const MAX_HISTORY_FRAMES = 120;

export type StartAnalysisJobDeps = {
  analyze?: (repoUrl: string, options: NormalizedJobOptions) => Promise<AnalysisArtifacts>;
  now?: () => string;
};

export type NormalizedJobOptions = {
  includeHistory: boolean;
  maxHistoryFrames: number;
  maxRenderedFiles?: number;
};

export type JobHandlerResult =
  | { status: 202; body: AnalysisJob }
  | { status: 400 | 404 | 413 | 500; body: { error: string } };

export async function startAnalysisJob(input: Partial<AnalyzeRequest>, deps: StartAnalysisJobDeps = {}): Promise<JobHandlerResult> {
  if (!input.repoUrl || typeof input.repoUrl !== "string") {
    return { status: 400, body: { error: "repoUrl is required." } };
  }

  try {
    parseGitHubUrl(input.repoUrl);
  } catch (error) {
    if (error instanceof InvalidRepoUrlError) {
      return { status: 400, body: { error: error.message } };
    }
    return { status: 400, body: { error: "Enter a public GitHub repository URL." } };
  }

  const now = deps.now?.() ?? new Date().toISOString();
  const job: AnalysisJob = {
    id: crypto.randomUUID(),
    repoUrl: input.repoUrl.trim(),
    status: "queued",
    stage: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now
  };
  const options = normalizeJobOptions(input);

  await writeJob(job);
  void runLocalJob(job, options, deps);

  return { status: 202, body: job };
}

export async function getAnalysisJob(jobId: string): Promise<AnalysisJob | null> {
  if (!isSafeId(jobId)) {
    return null;
  }

  try {
    const text = await fs.readFile(jobFile(jobId), "utf8");
    return JSON.parse(text) as AnalysisJob;
  } catch {
    return null;
  }
}

export async function readAnalysisArtifact(jobId: string, artifactId: string): Promise<unknown | null> {
  if (!isSafeId(jobId) || !isSafeArtifactId(artifactId)) {
    return null;
  }

  try {
    const text = await fs.readFile(artifactFile(jobId, artifactId), "utf8");
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function runLocalJob(job: AnalysisJob, options: NormalizedJobOptions, deps: StartAnalysisJobDeps) {
  const analyze = deps.analyze ?? analyzeGitHubRepositoryArtifacts;

  try {
    await updateJob(job.id, { status: "running", stage: "cloning", progress: 0.08 });
    await updateJob(job.id, { status: "running", stage: "analyzing", progress: options.includeHistory ? 0.16 : 0.2 });
    const artifacts = await analyze(job.repoUrl, options);
    await updateJob(job.id, { status: "running", stage: options.includeHistory ? "history" : "chunking", progress: 0.82 });
    const artifactRefs = await writeArtifacts(job.id, artifacts);
    await updateJob(job.id, {
      status: "succeeded",
      stage: "complete",
      progress: 1,
      artifacts: artifactRefs
    });
  } catch (error) {
    await updateJob(job.id, {
      status: "failed",
      stage: "failed",
      progress: 1,
      error: messageForError(error)
    });
  }
}

async function writeArtifacts(jobId: string, artifacts: AnalysisArtifacts): Promise<NonNullable<AnalysisJob["artifacts"]>> {
  const chunkIds = artifacts.chunks.map((chunk) => chunk.id);
  const historyFrameIds = artifacts.historyFrames.map((frame) => frame.id);

  await Promise.all([
    writeArtifact(jobId, "manifest", artifacts.manifest),
    writeArtifact(jobId, "index", artifacts.index),
    ...artifacts.chunks.map((chunk) => writeArtifact(jobId, chunk.id, chunk)),
    ...artifacts.historyFrames.map((frame) => writeArtifact(jobId, frame.id, frame))
  ]);

  return {
    manifest: "manifest",
    index: "index",
    chunks: chunkIds,
    historyFrames: historyFrameIds
  };
}

async function writeArtifact(jobId: string, artifactId: string, value: unknown) {
  await fs.mkdir(jobDir(jobId), { recursive: true });
  const target = artifactFile(jobId, artifactId);
  const temp = `${target}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value), "utf8");
  await fs.rename(temp, target);
}

async function updateJob(jobId: string, patch: Partial<AnalysisJob>) {
  const existing = await getAnalysisJob(jobId);
  if (!existing) {
    return;
  }

  await writeJob({
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

async function writeJob(job: AnalysisJob) {
  await fs.mkdir(jobDir(job.id), { recursive: true });
  const target = jobFile(job.id);
  const temp = `${target}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(job), "utf8");
  await fs.rename(temp, target);
}

function normalizeJobOptions(input: Partial<AnalyzeRequest>): NormalizedJobOptions {
  return {
    includeHistory: input.includeHistory === true,
    maxHistoryFrames: clampInt(Number(input.maxHistoryFrames) || 60, 2, MAX_HISTORY_FRAMES),
    maxRenderedFiles: typeof input.maxRenderedFiles === "number" ? clampInt(input.maxRenderedFiles, 100, MAX_RENDERED_FILES) : undefined
  };
}

function messageForError(error: unknown): string {
  if (error instanceof InvalidRepoUrlError || error instanceof RepoUnavailableError || error instanceof RepoTooLargeError) {
    return error.message;
  }
  return "RepoBricks could not analyze this repository.";
}

function jobDir(jobId: string): string {
  return path.join(JOB_ROOT, jobId);
}

function jobFile(jobId: string): string {
  return path.join(jobDir(jobId), "job.json");
}

function artifactFile(jobId: string, artifactId: string): string {
  return path.join(jobDir(jobId), `${artifactId}.json`);
}

function isSafeId(value: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(value);
}

function isSafeArtifactId(value: string): boolean {
  return /^(manifest|index|chunk-[A-Za-z0-9_.-]+|history-[A-Fa-f0-9]{7,40})$/.test(value);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
