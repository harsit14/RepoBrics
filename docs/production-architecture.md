# RepoBricks Production Architecture

RepoBricks now has two analysis paths:

1. `POST /api/analyze` returns the legacy synchronous `WorldManifest`.
2. `POST /api/analyze/jobs` creates an asynchronous analysis job and stores versioned artifacts:
   - `manifest`
   - `index`
   - `chunk-*`
   - `history-*`

The local job runner is intentionally file-backed and single-process. It gives the app the production API shape without pretending that a Next.js process is a distributed queue.

## Recommended Deployment

Use the frontend as a static/edge app and keep repository analysis in a Node container:

```text
Browser
  -> Cloudflare Pages app
  -> API gateway / Next route handlers
  -> Supabase Postgres: job metadata and artifact references
  -> Supabase Storage or Cloudflare R2: JSON artifacts
  -> Railway analyzer worker: git clone, scan, chunk, history frames
```

Railway is the right home for the analyzer worker because it can run Node with `git`, temporary disk, and longer CPU windows. Cloudflare Workers and Supabase Edge Functions are better suited for request routing, status reads, and signed artifact URLs.

## Job Lifecycle

1. Client submits `{ repoUrl, includeHistory, maxHistoryFrames }`.
2. API validates the GitHub URL and creates a queued job.
3. Worker claims one queued job.
4. Worker clones the repo:
   - `--depth 1` for normal analysis.
   - `--depth maxHistoryFrames` when history capture is enabled.
5. Worker emits `AnalysisArtifacts`.
6. Worker uploads artifacts and marks the job complete.
7. Client fetches `index`, loads nearest `chunk-*` artifacts first, and continues prefetching around the current camera.
8. Legacy clients can fetch `manifest`.

## Suggested Supabase Tables

```sql
create table analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  repo_url text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  stage text not null,
  progress numeric not null default 0,
  include_history boolean not null default false,
  max_history_frames integer not null default 60,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table analysis_artifacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references analysis_jobs(id) on delete cascade,
  artifact_id text not null,
  kind text not null check (kind in ('manifest', 'index', 'chunk', 'history_frame')),
  storage_path text not null,
  bytes integer not null,
  created_at timestamptz not null default now(),
  unique (job_id, artifact_id)
);

create index analysis_jobs_status_created_idx
  on analysis_jobs (status, created_at);

create index analysis_artifacts_job_idx
  on analysis_artifacts (job_id);
```

## Worker Environment

Railway worker variables:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
REPOBRICKS_ARTIFACT_BUCKET=analysis-artifacts
REPOBRICKS_MAX_RENDERED_FILES=10000
REPOBRICKS_MAX_HISTORY_FRAMES=120
REPOBRICKS_JOB_CONCURRENCY=1
```

Keep concurrency conservative at first. Git operations are bursty on CPU, disk, and network; one worker instance with concurrency `1` is easier to reason about and scale horizontally later.

## Artifact Strategy

Small repos can still load `manifest` directly. Large repos now load:

1. `index` for map bounds, districts, stats, and chunk refs.
2. Nearby `chunk-*` artifacts based on camera position.
3. Active chunks are composed back into the existing renderer-facing `WorldManifest` contract.
4. `history-*` frames power the visible timeline and changed-file highlights.

Artifacts are immutable for a specific repo commit. Future cache keys should include:

```text
owner/repo + branch + HEAD sha + analyzer version + options hash
```

## Next Implementation Steps

1. Add a dedicated Railway worker package/script that claims queued Supabase jobs.
2. Replace local file artifact storage with Supabase Storage or Cloudflare R2.
3. Add cache lookup by repo HEAD sha before creating a new job.
4. Add signed artifact URLs and CDN cache headers.
5. Persist user-facing job history and shareable world links.
