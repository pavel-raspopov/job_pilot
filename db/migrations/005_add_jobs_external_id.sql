-- =============================================================================
-- Job deduplication — one row per Adzuna listing per user
--
-- Until now every search saved every listing Adzuna returned, so repeating a
-- search doubled the list and re-scored (and re-billed) jobs the user already
-- had, often at a different score. This adds the provider's own listing id and
-- makes "one row per (user, listing)" a database guarantee rather than an
-- application-side check that two concurrent searches could both pass.
--
-- Why the Adzuna id and not the apply URL: `redirect_url` carries a
-- per-request tracking query string (`se`, `utm_*`), so the same listing
-- arrives with a different URL each time. Its PATH, though, is
-- `/land/ad/<id>` or `/details/<id>`, and the id is stable — probed on
-- 2026-10-22 against listings first saved a month earlier.
--
-- Why not title + company (the build plan's original key): it merges two
-- openings that share a title at one employer, and splits one listing if the
-- provider edits its title.
--
-- Why the unique constraint is NOT partial (`where source = 'search'`):
-- PostgREST's `on_conflict` emits `ON CONFLICT (cols)` with no predicate, and
-- Postgres can only infer a non-partial unique index from that. A partial one
-- would make every conflict-ignoring insert fail. NULLs are distinct, so rows
-- with no external id (a future `source = 'url'`) never conflict.
--
-- Re-runnable: every step is guarded or a no-op the second time.
-- =============================================================================

alter table public.jobs add column if not exists external_id text;

-- Backfill from the apply URL's path. Rows whose URL does not carry an id stay
-- NULL and are caught by the CHECK below, which fails the migration loudly
-- instead of leaving a silent hole in deduplication.
update public.jobs
   set external_id = substring(external_apply_url from '/(?:land/ad|details)/([0-9]+)')
 where source = 'search'
   and external_id is null;

-- Collapse existing duplicates. The earliest row wins: "Date Found" means when
-- the job was first found, and a re-found job is never re-scored.
--
-- A run's count means "jobs this run saved", so each run loses exactly the
-- copies deleted from it here — one statement, so the subtraction can only
-- ever see this delete. NOT a recount of every run from the surviving rows:
-- that would rewrite history on any re-run once jobs can be deleted, whereas a
-- re-run of this statement deletes nothing and therefore changes nothing.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, external_id
           order by found_at, id
         ) as rn
    from public.jobs
   where external_id is not null
), collapsed as (
  delete from public.jobs j
   using ranked
   where j.id = ranked.id
     and ranked.rn > 1
  returning j.run_id
)
update public.agent_runs r
   set jobs_found = greatest(r.jobs_found - c.removed, 0)
  from (
    select run_id, count(*) as removed
      from collapsed
     where run_id is not null
     group by run_id
  ) c
 where r.id = c.run_id;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_user_external_id_key'
  ) then
    alter table public.jobs
      add constraint jobs_user_external_id_key unique (user_id, external_id);
  end if;

  -- Every search-found job must be deduplicable. The normaliser drops listings
  -- without an id, so this never rejects a live insert; it stops a future code
  -- path from quietly bypassing deduplication.
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_search_external_id_present'
  ) then
    alter table public.jobs
      add constraint jobs_search_external_id_present
      check (source <> 'search' or external_id is not null);
  end if;
end
$$;
