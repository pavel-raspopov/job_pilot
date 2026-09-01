-- =============================================================================
-- Phase 2 review follow-up — per-user rate limiting for AI routes
--
-- Every route that calls the InsForge AI gateway costs money per request, and
-- until now nothing stopped an authenticated user from looping one. The client
-- holds an in-flight ref guard, which stops an accidental double click but not
-- a deliberate `for` loop against the endpoint, and the free plan's credit is
-- $1/month. The guard has to live on the server.
--
-- It cannot live in process memory: serverless instances do not share any, so
-- an in-memory counter is per-instance and therefore not a limit at all. This
-- table is the shared state.
--
-- Shape: one row per billed call, rather than a counter per window. A log is
-- append-only, which means the check never has to read-modify-write a shared
-- counter, and it doubles as the cost telemetry Features 10 and 13 will want
-- ("how many gateway calls did this user actually make").
--
-- `route` is free text on purpose — no CHECK constraint. Features 10 and 13 add
-- their own routes, and a CHECK would make every new AI route a migration. The
-- allowed keys live in `lib/ai-rate-limit.ts` (`AI_ROUTE`), which is also where
-- the limits are.
--
-- RETENTION: rows outlive their window and nothing prunes them. At the current
-- limits that is at most ~240 rows per user per day, so it is not urgent, but a
-- periodic cleanup belongs in a scheduled job when one exists:
--
--   delete from public.ai_usage where created_at < now() - interval '7 days';
--
-- Deliberately NOT exposed as a user-callable delete (see the policies below).
-- =============================================================================

create table if not exists public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  route      text not null,
  created_at timestamptz not null default now()
);

-- The only query this table serves: "how many calls has this user made to this
-- route since T", ordered so the oldest in the window gives the retry time.
create index if not exists ai_usage_user_route_created_idx
  on public.ai_usage (user_id, route, created_at desc);

alter table public.ai_usage enable row level security;

-- Read and insert own rows only. A user inserting spurious rows can only lower
-- their own quota, so self-service insert is safe.
drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage
  for select using (auth.uid() = user_id);

drop policy if exists ai_usage_insert_own on public.ai_usage;
create policy ai_usage_insert_own on public.ai_usage
  for insert with check (auth.uid() = user_id);

-- No update and no delete policy, deliberately. A limit a user can clear is not
-- a limit; cleanup is an operator job, not a product feature.
