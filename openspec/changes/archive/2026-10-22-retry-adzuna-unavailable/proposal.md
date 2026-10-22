## Why

Adzuna sometimes answers a search with HTTP 503. A single request sent moments later
succeeds. Today `searchJobs()` treats that first 503 as an outage, so the user sees "Job
search is unavailable right now." for a search that would have worked a second later.
The Adzuna key is shared by every JobPilot user, so the more people search, the more
often this happens. It was found while verifying `add-job-deduplication` and recorded
in `context/progress-tracker.md` and `memory.md` as an open production problem.

## What Changes

- **`searchJobs()` retries a 503, and only a 503.** It makes at most two retries (three
  requests in total) and waits a short random interval before each: 300–600 ms before
  the first retry, 600–1200 ms before the second. The random part keeps two searches
  that were refused at the same moment from retrying at the same moment too.
- **All attempts share the existing 10 s `ADZUNA_TIMEOUT_MS` budget.** It is not 10 s per
  attempt. A retry is skipped when too little of the budget is left for a request to
  finish, so a search still ends within the time it has today.
- **A 429 is never retried.** It means the shared per-minute quota is used up. A retry
  within seconds cannot succeed, and each retry spends more of that quota.
- **A 503 that persists still fails exactly as now.** The route maps it to `SEARCH_ERROR`,
  records the run as failed, and charges no rate-limit slot. The route does not change.
- **Logging stays country + status only.** Each refused attempt logs its attempt number,
  never the key or the URL.

### Source reconciliation

| Conflict | Resolution |
|---|---|
| The tracker, `memory.md` and the brief say Adzuna 503s **concurrent** requests on one key, "even for two different queries" | **Probed on 2026-10-22: concurrency alone did not reproduce it.** Eight concurrent pairs and triples, both with identical and with different queries, returned 200. The four 503s and one 429 came during a burst of about 15 requests in 30 s. The same query on its own a minute later returned 200. So a 503 looks like load-shedding under a burst rather than a strict one-in-flight limit. **The fix is the same either way**, but a live concurrent pair is likely to pass without it, so it cannot prove the retry works. The retry is proved with a stubbed provider instead (design D6). Recommended: correct the tracker and `memory.md` wording when this ships. **Developer to confirm.** |

No context doc (`build-plan.md`, `architecture.md`, `library-docs.md`,
`project-overview.md`) says anything about Adzuna retries, quotas or 503s, so there is no
other conflict.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `job-discovery`: the provider-failure requirement now says a momentary
  unavailability is retried a bounded number of times, within the provider time limit,
  before the search fails. A quota refusal is not retried. A search recovered by a
  retry still costs one unit of the allowance.

## Impact

**Modified:** `agent/adzuna.ts` (`searchJobs()` gains the retry loop. A small `sleep`
helper and the backoff constants go beside the existing constants).

**Unchanged:** `app/api/agent/find/route.ts` (it still sees one result per search), the
rate limiter, the matcher, and the database.

**Docs:** `context/library-docs.md` (Adzuna section: the 503 retry and why 429 is not
retried), `context/progress-tracker.md`, `memory.md`.

**Dependencies:** none.

### Human gates

- **Live checks need a signed-in Browser pane.** Signing in is the developer's job.
- **Each live search spends shared Adzuna quota.** A search costs one to three requests,
  plus up to two gateway calls when there are new listings to score. `ADZUNA_APP_ID` and
  `ADZUNA_APP_KEY` are present in `.env.local` (names checked, values never printed). The
  free tier answered 429 during the probing burst, so live checks are spaced out.

## Non-goals

- **Queueing or serialising Adzuna calls across users.** That would need shared state
  across serverless instances, such as a lock in the database. A bounded retry covers
  the transient case without it.
- **Retrying 429, timeouts, network errors or other 5xx.** None of these were observed
  as transient, and retrying a timeout would use up the budget.
- **Honouring `Retry-After`.** Adzuna sent none on its 503s or its 429.
- **Caching search results** to save quota.
- **Any change to the route, the UI copy, or the rate limiter.**
- **A test framework.** Verification is `npm run lint`, `npx tsc --noEmit`,
  `npm run build`, `openspec validate --all --strict`, an offline harness with a stubbed
  `fetch`, and live checks in the Browser pane.
