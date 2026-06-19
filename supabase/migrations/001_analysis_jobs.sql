create extension if not exists pgcrypto;

create table if not exists public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  repo_url text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  stage text not null,
  progress numeric not null default 0 check (progress >= 0 and progress <= 1),
  include_history boolean not null default false,
  max_history_frames integer not null default 60 check (max_history_frames >= 2 and max_history_frames <= 250),
  max_rendered_files integer check (max_rendered_files is null or (max_rendered_files >= 100 and max_rendered_files <= 10000)),
  claimed_by text,
  claimed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analysis_artifacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.analysis_jobs(id) on delete cascade,
  artifact_id text not null,
  kind text not null check (kind in ('manifest', 'index', 'chunk', 'history_frame')),
  storage_path text not null,
  bytes integer not null check (bytes >= 0),
  created_at timestamptz not null default now(),
  unique (job_id, artifact_id)
);

create index if not exists analysis_jobs_status_created_idx
  on public.analysis_jobs (status, created_at);

create index if not exists analysis_artifacts_job_idx
  on public.analysis_artifacts (job_id);

insert into storage.buckets (id, name, public)
values ('analysis-artifacts', 'analysis-artifacts', false)
on conflict (id) do nothing;

alter table public.analysis_jobs enable row level security;
alter table public.analysis_artifacts enable row level security;

drop policy if exists "Service role manages analysis jobs" on public.analysis_jobs;
create policy "Service role manages analysis jobs"
  on public.analysis_jobs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages analysis artifacts" on public.analysis_artifacts;
create policy "Service role manages analysis artifacts"
  on public.analysis_artifacts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.claim_analysis_job(p_worker_id text)
returns public.analysis_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.analysis_jobs;
begin
  update public.analysis_jobs
  set
    status = 'running',
    stage = 'cloning',
    progress = 0.05,
    claimed_by = p_worker_id,
    claimed_at = now(),
    updated_at = now()
  where id = (
    select id
    from public.analysis_jobs
    where status = 'queued'
    order by created_at asc
    limit 1
    for update skip locked
  )
  returning * into claimed;

  return claimed;
end;
$$;
