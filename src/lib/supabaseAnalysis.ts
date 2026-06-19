import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisArtifacts, AnalysisJob, AnalyzeRequest } from "@/types/world";
import { analyzeGitHubRepositoryArtifacts, RepoTooLargeError, RepoUnavailableError } from "@/lib/analyzer";
import { InvalidRepoUrlError, parseGitHubUrl } from "@/lib/github";
import type { NormalizedJobOptions } from "@/lib/analysisJobs";

const DEFAULT_BUCKET = "analysis-artifacts";
const DEFAULT_MAX_RENDERED_FILES = 10_000;
const DEFAULT_MAX_HISTORY_FRAMES = 120;

type AnalysisJobRow = {
  id: string;
  repo_url: string;
  status: AnalysisJob["status"];
  stage: AnalysisJob["stage"];
  progress: number;
  include_history: boolean;
  max_history_frames: number;
  max_rendered_files: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type AnalysisArtifactRow = {
  artifact_id: string;
  kind: "manifest" | "index" | "chunk" | "history_frame";
  storage_path: string;
};

export type SupabaseAnalysisConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

export type SupabaseJobResult =
  | { status: 202; body: AnalysisJob }
  | { status: 400 | 500; body: { error: string } };

export function supabaseAnalysisConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabaseAnalysisConfigFromEnv(): SupabaseAnalysisConfig {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the Supabase job backend.");
  }

  return {
    url,
    serviceRoleKey,
    bucket: process.env.REPOBRICKS_ARTIFACT_BUCKET ?? DEFAULT_BUCKET
  };
}

export function createSupabaseAdmin(config = supabaseAnalysisConfigFromEnv()): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function startSupabaseAnalysisJob(
  input: Partial<AnalyzeRequest>,
  client = createSupabaseAdmin()
): Promise<SupabaseJobResult> {
  if (!input.repoUrl || typeof input.repoUrl !== "string") {
    return { status: 400, body: { error: "repoUrl is required." } };
  }

  try {
    parseGitHubUrl(input.repoUrl);
  } catch (error) {
    return {
      status: 400,
      body: { error: error instanceof InvalidRepoUrlError ? error.message : "Enter a public GitHub repository URL." }
    };
  }

  const options = normalizeSupabaseJobOptions(input);
  const { data, error } = await client
    .from("analysis_jobs")
    .insert({
      repo_url: input.repoUrl.trim(),
      status: "queued",
      stage: "queued",
      progress: 0,
      include_history: options.includeHistory,
      max_history_frames: options.maxHistoryFrames,
      max_rendered_files: options.maxRenderedFiles ?? null
    })
    .select("*")
    .single<AnalysisJobRow>();

  if (error || !data) {
    return { status: 500, body: { error: error?.message ?? "RepoBricks could not create an analysis job." } };
  }

  return { status: 202, body: await jobFromRow(data, client) };
}

export async function getSupabaseAnalysisJob(jobId: string, client = createSupabaseAdmin()): Promise<AnalysisJob | null> {
  if (!isSafeId(jobId)) {
    return null;
  }

  const { data, error } = await client.from("analysis_jobs").select("*").eq("id", jobId).single<AnalysisJobRow>();
  if (error || !data) {
    return null;
  }

  return jobFromRow(data, client);
}

export async function readSupabaseAnalysisArtifact(
  jobId: string,
  artifactId: string,
  client = createSupabaseAdmin(),
  bucket = process.env.REPOBRICKS_ARTIFACT_BUCKET ?? DEFAULT_BUCKET
): Promise<unknown | null> {
  if (!isSafeId(jobId) || !isSafeArtifactId(artifactId)) {
    return null;
  }

  const { data: artifact, error: artifactError } = await client
    .from("analysis_artifacts")
    .select("artifact_id, kind, storage_path")
    .eq("job_id", jobId)
    .eq("artifact_id", artifactId)
    .single<AnalysisArtifactRow>();

  if (artifactError || !artifact) {
    return null;
  }

  const { data, error } = await client.storage.from(bucket).download(artifact.storage_path);
  if (error || !data) {
    return null;
  }

  return JSON.parse(await data.text()) as unknown;
}

export async function claimNextSupabaseJob(
  workerId = defaultWorkerId(),
  client = createSupabaseAdmin()
): Promise<AnalysisJobRow | null> {
  const { data, error } = await client.rpc("claim_analysis_job", { p_worker_id: workerId }).single<AnalysisJobRow>();
  if (error || !data) {
    return null;
  }
  return data;
}

export async function processSupabaseJob(
  job: AnalysisJobRow,
  client = createSupabaseAdmin(),
  config = supabaseAnalysisConfigFromEnv()
): Promise<void> {
  const options: NormalizedJobOptions = {
    includeHistory: job.include_history,
    maxHistoryFrames: job.max_history_frames,
    maxRenderedFiles: job.max_rendered_files ?? undefined
  };

  try {
    await updateSupabaseJob(client, job.id, { status: "running", stage: "analyzing", progress: options.includeHistory ? 0.16 : 0.22 });
    const artifacts = await analyzeGitHubRepositoryArtifacts(job.repo_url, options);
    await updateSupabaseJob(client, job.id, { status: "running", stage: options.includeHistory ? "history" : "chunking", progress: 0.82 });
    const refs = await uploadSupabaseArtifacts(client, config.bucket, job.id, artifacts);
    await updateSupabaseJob(client, job.id, {
      status: "succeeded",
      stage: "complete",
      progress: 1,
      error: null
    });
    await ensureArtifactRefsVisible(client, job.id, refs);
  } catch (error) {
    await updateSupabaseJob(client, job.id, {
      status: "failed",
      stage: "failed",
      progress: 1,
      error: messageForError(error)
    });
  }
}

async function uploadSupabaseArtifacts(
  client: SupabaseClient,
  bucket: string,
  jobId: string,
  artifacts: AnalysisArtifacts
): Promise<NonNullable<AnalysisJob["artifacts"]>> {
  const entries: Array<{ artifactId: string; kind: AnalysisArtifactRow["kind"]; value: unknown }> = [
    { artifactId: "manifest", kind: "manifest", value: artifacts.manifest },
    { artifactId: "index", kind: "index", value: artifacts.index },
    ...artifacts.chunks.map((chunk) => ({ artifactId: chunk.id, kind: "chunk" as const, value: chunk })),
    ...artifacts.historyFrames.map((frame) => ({ artifactId: frame.id, kind: "history_frame" as const, value: frame }))
  ];

  for (const entry of entries) {
    const storagePath = artifactPath(jobId, entry.artifactId);
    const body = Buffer.from(JSON.stringify(entry.value));
    const { error: uploadError } = await client.storage.from(bucket).upload(storagePath, body, {
      contentType: "application/json; charset=utf-8",
      upsert: true
    });
    if (uploadError) {
      throw uploadError;
    }

    const { error: insertError } = await client.from("analysis_artifacts").upsert(
      {
        job_id: jobId,
        artifact_id: entry.artifactId,
        kind: entry.kind,
        storage_path: storagePath,
        bytes: body.byteLength
      },
      { onConflict: "job_id,artifact_id" }
    );
    if (insertError) {
      throw insertError;
    }
  }

  return {
    manifest: "manifest",
    index: "index",
    chunks: artifacts.chunks.map((chunk) => chunk.id),
    historyFrames: artifacts.historyFrames.map((frame) => frame.id)
  };
}

async function ensureArtifactRefsVisible(
  client: SupabaseClient,
  jobId: string,
  refs: NonNullable<AnalysisJob["artifacts"]>
): Promise<void> {
  // Reads the rows once after upload; this catches permission/schema mistakes before
  // the worker reports success and gives the API route a consistent artifact view.
  const artifactCount = 2 + refs.chunks.length + refs.historyFrames.length;
  const { count, error } = await client
    .from("analysis_artifacts")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);
  if (error || count !== artifactCount) {
    throw new Error(error?.message ?? "Uploaded artifact count did not match the expected job artifacts.");
  }
}

async function jobFromRow(row: AnalysisJobRow, client: SupabaseClient): Promise<AnalysisJob> {
  const artifacts = row.status === "succeeded" ? await artifactRefsForJob(row.id, client) : undefined;

  return {
    id: row.id,
    repoUrl: row.repo_url,
    status: row.status,
    stage: row.stage,
    progress: Number(row.progress),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    error: row.error ?? undefined,
    artifacts
  };
}

async function artifactRefsForJob(jobId: string, client: SupabaseClient): Promise<AnalysisJob["artifacts"]> {
  const { data, error } = await client
    .from("analysis_artifacts")
    .select("artifact_id, kind, storage_path")
    .eq("job_id", jobId)
    .order("artifact_id", { ascending: true })
    .returns<AnalysisArtifactRow[]>();

  if (error || !data || data.length === 0) {
    return undefined;
  }

  return {
    manifest: data.find((artifact) => artifact.kind === "manifest")?.artifact_id ?? "manifest",
    index: data.find((artifact) => artifact.kind === "index")?.artifact_id ?? "index",
    chunks: data.filter((artifact) => artifact.kind === "chunk").map((artifact) => artifact.artifact_id),
    historyFrames: data.filter((artifact) => artifact.kind === "history_frame").map((artifact) => artifact.artifact_id)
  };
}

async function updateSupabaseJob(client: SupabaseClient, jobId: string, patch: Partial<AnalysisJobRow>) {
  const { error } = await client
    .from("analysis_jobs")
    .update({
      ...patch,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  if (error) {
    throw error;
  }
}

function normalizeSupabaseJobOptions(input: Partial<AnalyzeRequest>): NormalizedJobOptions {
  return {
    includeHistory: input.includeHistory === true,
    maxHistoryFrames: clampInt(Number(input.maxHistoryFrames) || 60, 2, DEFAULT_MAX_HISTORY_FRAMES),
    maxRenderedFiles: typeof input.maxRenderedFiles === "number" ? clampInt(input.maxRenderedFiles, 100, DEFAULT_MAX_RENDERED_FILES) : undefined
  };
}

function artifactPath(jobId: string, artifactId: string): string {
  return `${jobId}/${artifactId}.json`;
}

function defaultWorkerId(): string {
  return process.env.RAILWAY_REPLICA_ID ?? process.env.HOSTNAME ?? `worker-${crypto.randomUUID()}`;
}

function messageForError(error: unknown): string {
  if (error instanceof InvalidRepoUrlError || error instanceof RepoUnavailableError || error instanceof RepoTooLargeError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "RepoBricks could not analyze this repository.";
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
