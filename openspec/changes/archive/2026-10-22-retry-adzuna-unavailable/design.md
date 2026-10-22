## Context

See `proposal.md` (Why). The requirement is in `specs/job-discovery/spec.md`. This
document covers only how it is met.

These facts constrain the approach. Each was established before this design was written:

- **Adzuna's 503 is transient and fast.** On 2026-10-22 the four 503s answered in
  630–700 ms, and the same query a minute later returned 200. No `Retry-After` header came
  with the 503s or with the 429.
- **A successful uncached search is slow.** Searches with a `where` took 1.8–2.9 s, and
  cached ones about 0.8 s. A retry is only worth making if enough budget is left for a
  slow success.
- **The free tier enforces a per-minute quota with 429.** A burst of about 15 requests
  in 30 s drew a 429 alongside the 503s.
- **`searchJobs()` never throws** and returns `{ success: false, error }`. The route
  charges the rate-limit slot only after `search.success` (`route.ts` around line 193),
  so a failure after retries still costs the user nothing. The route needs no change.
- **The one `AbortSignal.timeout(ADZUNA_TIMEOUT_MS)`** is the search's whole provider
  budget. The route's `maxDuration = 120` belongs to the model call.

### Files in scope

**Modified:** `agent/adzuna.ts` (`searchJobs()` and new constants beside the existing
ones), plus the docs named in the proposal.

**Frozen:** `app/api/agent/find/route.ts`, `agent/matcher.ts`, `lib/ai-rate-limit.ts`,
`lib/env.ts`, `types/index.ts`, and all UI. Changes to these are limited to one-line type
or compile fixes, and only if a named verify command fails.

**Temporary, never committed:** one extra configuration in `.claude/launch.json` for the
stubbed-provider dev server (D6). It is reverted before commit, and `git diff` shows the
file unchanged.

## Goals / Non-Goals

**Goals:** a momentary 503 no longer reaches the user, the search's provider time stays
bounded by the existing 10 s, and quota spend is bounded at three requests per search.

**Non-Goals:** cross-instance coordination of Adzuna calls, and any change to what the
route reports or charges. See also the proposal's Non-goals.

## Decisions

### D1. Retry on 503 only

A 503 is the one status observed to clear within seconds. A **429** means the per-minute
quota is spent: a retry within the budget cannot succeed, and each one burns quota that
every other user shares. **Other 5xx** were not observed, and treating them as transient
would be a guess. A **timeout** has already used the whole budget. A **network error** is
already outside the response path, in the `catch` block.

*Alternative:* retry every 5xx and network errors. Rejected because it spends quota on
failures with no evidence that they recover.

### D2. Three attempts at most, jittered exponential waits

Attempt *n* (n = 1, 2) is followed by a wait drawn uniformly from
`[300·2^(n−1), 600·2^(n−1)]` ms: 300–600 ms, then 600–1200 ms. The constants are
`ADZUNA_MAX_ATTEMPTS = 3` and `ADZUNA_RETRY_BASE_MS = 300`. The upper bound is twice the
lower one. The random spread decorrelates two searches refused at the same instant, so
they do not collide again on the retry.

Worst case with three 503s: 0.7 + 0.6 + 0.7 + 1.2 + 0.7 ≈ 3.9 s, well inside 10 s. The
worst case that ends in success is about 3.2 s of 503s and waits, then a 2.9 s success:
about 6.1 s.

*Alternative:* a fixed delay. Rejected because two refused searches would retry in lock
step.

### D3. One deadline for all attempts

`const signal = AbortSignal.timeout(ADZUNA_TIMEOUT_MS)` is created once, before the
first attempt, and passed to every `fetch`. So the 10 s budget covers the whole search,
not each attempt. Before each wait, the loop checks
`deadline − now − wait ≥ ADZUNA_MIN_ATTEMPT_MS` (2 500 ms, a slow success plus margin).
If the check fails, it stops and returns the 503 rather than starting a request the
abort would cut off. The wait itself is a plain `setTimeout` promise. It needs no abort,
because the check has already ensured it ends before the deadline.

*Alternative:* a new `AbortSignal.timeout` per attempt. Rejected because it would let
three slow attempts take 30 s.

### D4. Release the refused response's body before waiting

`await response.body?.cancel()` (with its rejection swallowed) runs before each wait.
Otherwise undici keeps the socket tied to an unread body. The final 503 is not retried,
so it goes down the existing `!response.ok` path unchanged.

### D5. Logging and the error string

Each retried 503 logs `console.warn("[agent/adzuna] provider returned 503 for", country,
"- retrying", attempt, "of", ADZUNA_MAX_ATTEMPTS - 1)`. The line carries country, status
and attempt number, never the URL or the key. The final failure keeps the existing
`console.error` line. Its internal error string becomes ``adzuna http ${status} after
${attempt} attempt(s)``, so the route's log shows whether retries were spent. No user
sees this string. A search recovered on a later attempt logs the existing "returned N
usable listings" line unchanged.

### D6. Verification without being able to make Adzuna answer 503

A real 503 cannot be produced on demand. Concurrency alone did not reproduce one (see
proposal). So the retry is proved at two levels, and neither changes app code:

1. **Offline harness** (scratchpad). It stubs `globalThis.fetch` with a scripted
   sequence of statuses and delays, sets dummy `ADZUNA_*` values, and imports
   `agent/adzuna.ts`. It counts the calls, measures the waits and the total time, and
   captures the console output to check that it never contains the dummy key or id.
2. **Stubbed-provider dev server.** A scratchpad preload module is loaded with
   `NODE_OPTIONS=--import=<file URL>`. It wraps `globalThis.fetch` for
   `api.adzuna.com` only. Under `ADZUNA_STUB=first-503` it answers 503 for the first call
   of each search (every odd call) and passes the rest through to real Adzuna. Under
   `ADZUNA_STUB=always-503` it never reaches Adzuna. Next patches `fetch` on top of
   whatever is global at startup, so the wrapper sits beneath Next's own. A stub log
   line proves it took effect. It runs from a temporary `.claude/launch.json` entry that
   is reverted before commit.

Row counts before and after, via InsForge MCP `run-raw-sql`, check the "run failed / no
slot" outcome rather than reading code.

## Risks / Trade-offs

- **[A retry adds load to a struggling provider]** → It is bounded at two retries, made
  only on 503, and jittered.
- **[More quota per search]** → It is at most three requests, and only when Adzuna
  already refused. Normal searches still make one.
- **[A burst from many users could still exhaust three attempts]** → The search then
  fails exactly as today. Cross-instance queueing is a non-goal. If it happens in
  production, the warn lines will show it.
- **[The preload stub may not take effect under `next dev`]** → The stub's own log line
  is checked first. If it does not take, the dev-server checks fall back to: the harness
  (module behaviour), plus the route's failure path, which this change does not touch
  and which was verified live in `add-job-deduplication` 6.3.
- **[Jitter makes the harness timing non-deterministic]** → The harness asserts that
  each wait falls in its range, not an exact value.

## Migration Plan

None. This is a code-only change with no schema or config. Rollback is a revert of
`agent/adzuna.ts`.
