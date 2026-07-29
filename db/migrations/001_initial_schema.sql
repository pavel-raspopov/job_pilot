-- =============================================================================
-- Feature 04 — Database Schema (initial migration)
--
-- Creates the four application tables (profiles, agent_runs, jobs, agent_logs)
-- with row level security scoped to the authenticated user via auth.uid().
--
-- Notes:
-- * user_id columns reference auth.users(id) directly (not profiles.id) so
--   agent runs are never blocked before the user saves a profile in Feature 06.
--   profiles.id itself references auth.users(id), so the values are identical.
-- * No triggers, no seed data. Profile rows are created by app-level upsert
--   (Feature 06); updated_at is maintained by the Server Action.
-- * Applied via the InsForge MCP run-raw-sql tool. Kept in the repo as the
--   reproducible source of truth for the backend schema.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles — one row per user, keyed on the auth user id
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text,
  email               text,
  phone               text,
  location            text,
  current_title       text,
  experience_level    text,
  years_experience    integer,
  skills              text[]      not null default '{}',
  industries          text[]      not null default '{}',
  work_experience     jsonb,
  education           jsonb,
  job_titles_seeking  text[]      not null default '{}',
  remote_preference   text,
  preferred_locations text[]      not null default '{}',
  salary_expectation  text,
  cover_letter_tone   text,
  linkedin_url        text,
  portfolio_url       text,
  work_authorization  text,
  resume_pdf_url      text,
  is_complete         boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- agent_runs — one row per job-discovery run
-- ---------------------------------------------------------------------------
create table if not exists public.agent_runs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users(id) on delete cascade,
  status             text        not null default 'running'
                       check (status in ('running', 'completed', 'failed')),
  job_title_searched text,
  location_searched  text,
  jobs_found         integer,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz
);

-- ---------------------------------------------------------------------------
-- jobs — discovered jobs, scored against the user profile
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id                 uuid primary key default gen_random_uuid(),
  run_id             uuid        references public.agent_runs(id) on delete set null,
  user_id            uuid        not null references auth.users(id) on delete cascade,
  source             text        not null check (source in ('search', 'url')),
  source_url         text,
  external_apply_url text,
  title              text,
  company            text,
  location           text,
  salary             text,
  job_type           text,
  about_role         text,
  responsibilities   text[],
  requirements       text[],
  nice_to_have       text[],
  benefits           text[],
  about_company      text,
  match_score        integer     check (match_score between 0 and 100),
  match_reason       text,
  matched_skills     text[],
  missing_skills     text[],
  company_research   jsonb,
  found_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- agent_logs — human readable log entries per run
-- ---------------------------------------------------------------------------
create table if not exists public.agent_logs (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid        not null references public.agent_runs(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  message    text        not null,
  level      text        not null default 'info'
               check (level in ('info', 'success', 'warning', 'error')),
  job_id     uuid        references public.jobs(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes — query paths used by Find Jobs (filter/sort/paginate) and Dashboard
-- ---------------------------------------------------------------------------
create index if not exists jobs_user_found_at_idx    on public.jobs (user_id, found_at desc);
create index if not exists jobs_user_match_score_idx on public.jobs (user_id, match_score desc);
create index if not exists agent_runs_user_started_at_idx on public.agent_runs (user_id, started_at desc);
create index if not exists agent_logs_run_id_idx     on public.agent_logs (run_id);

-- ---------------------------------------------------------------------------
-- Row level security — every row is owned by exactly one user.
-- Policies are gated on auth.uid(); anonymous requests (auth.uid() is null)
-- match nothing. No TO clause: the auth.uid() check is the gate.
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.agent_runs enable row level security;
alter table public.jobs       enable row level security;
alter table public.agent_logs enable row level security;

-- profiles: keyed on id = auth.uid()
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete_own on public.profiles
  for delete using (id = auth.uid());

-- agent_runs
create policy agent_runs_select_own on public.agent_runs
  for select using (user_id = auth.uid());
create policy agent_runs_insert_own on public.agent_runs
  for insert with check (user_id = auth.uid());
create policy agent_runs_update_own on public.agent_runs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy agent_runs_delete_own on public.agent_runs
  for delete using (user_id = auth.uid());

-- jobs
create policy jobs_select_own on public.jobs
  for select using (user_id = auth.uid());
create policy jobs_insert_own on public.jobs
  for insert with check (user_id = auth.uid());
create policy jobs_update_own on public.jobs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy jobs_delete_own on public.jobs
  for delete using (user_id = auth.uid());

-- agent_logs
create policy agent_logs_select_own on public.agent_logs
  for select using (user_id = auth.uid());
create policy agent_logs_insert_own on public.agent_logs
  for insert with check (user_id = auth.uid());
create policy agent_logs_update_own on public.agent_logs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy agent_logs_delete_own on public.agent_logs
  for delete using (user_id = auth.uid());
