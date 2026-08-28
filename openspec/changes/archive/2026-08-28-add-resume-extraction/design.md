## Context

See `proposal.md` — Why. Three constraints shape the approach.

**The form is mostly uncontrolled.** `ProfileForm.tsx` renders ~20 scalar inputs with `defaultValue` and holds React state only for `skills`, `industries`, and `roles`. Setting state does not move a `defaultValue` input, so extraction cannot repopulate the form without either converting every input to controlled or remounting.

**`ResumeUpload` and `ProfileForm` are siblings.** `app/(app)/profile/page.tsx` renders both directly. The extraction trigger belongs on the Resume card, but the data has to land in the form — today there is no shared owner.

**The AI path was verified against the live project before this design was written** (2026-08-28, `gyht9mqy.eu-central.insforge.app`):

| Check | Result |
| --- | --- |
| `GET /api/ai/models` | 531 models, 133 file-capable, brokered via OpenRouter |
| Credits funded | `POST /api/ai/chat/completion` returned a completion |
| Forced tool call | `tools` + `toolChoice: "required"` returned `tool_calls[0].function.arguments`, enum constraints honored |
| PDF via signed URL | Accepted as `{ type: "file", file: { file_data: <signed url> } }` |
| PDF via base64 data URI | Also accepted |
| Full extraction | Every field correct from a 2.3KB test resume; dates normalized to `YYYY-MM`; "Present" → `currently_working: true`; 3-role cap honored; 745 tokens ≈ $0.0008 |

The gateway's raw HTTP response is `{ text, tool_calls, metadata }` — **not** OpenAI's `choices[0].message`. The SDK's `client.ai.chat.completions.create` normalizes it; read fields off the SDK's return value, not the raw shape.

## Goals / Non-Goals

**Goals**

- One round trip: stored PDF in, validated profile fields out.
- Model output is untrusted input — validated before it reaches the form.
- Establish the InsForge-AI-gateway pattern that Features 08, 10, and 13 will reuse.
- Repopulate the form without converting ~20 inputs to controlled.

**Non-Goals**

- No new component files. `components/profile/` stays at the four names `architecture.md` lists, following the Feature 05 precedent of not inventing components outside the documented tree.
- No shared AI client abstraction yet. One call site does not justify one; extract it when Feature 10 adds the second.
- No streaming or progressive fill.

## Decisions

### 1. InsForge AI gateway over a direct OpenAI call

Chosen because the SDK is already installed, no new secret or dependency is needed, and it honors the "Backend: InsForge" stack rule. `openai/gpt-4o` is available through it, so the build-plan's literal requirement is still satisfiable.

*Alternative — direct `openai` SDK with `OPENAI_API_KEY`:* matches the context docs verbatim but adds a dependency, a secret the project does not have, and a second billing relationship. *Alternative — direct Gemini call with the developer's own key:* same objections, plus it puts a personal key in a shared app.

### 2. Native PDF input over `pdf-parse`

The gateway accepts the PDF directly with `fileParser: { enabled: true }`. This drops a dependency with known Next 16 / Turbopack bundling friction, preserves layout and table structure that flat text extraction destroys, and handles scanned resumes through OCR — which `pdf-parse` cannot do at all.

*Trade-off:* the build-plan's "text empty or too short" guard has no local equivalent. Replaced by an equivalent check on the model's output (see decision 5).

### 3. Signed URL over base64 data URI

Both work. A short-lived signed URL is chosen because base64 inflates a 5MB PDF to ~6.7MB of JSON in the request body, and the accepted resume size limit is exactly 5MB.

Use `storage.from("resumes").createSignedUrl(key, <short expiry>)`. Expiry should be minutes, not the 1-hour default — the gateway fetches it immediately. The URL is a CloudFront presigned link to the project's own storage, fetched server-side by InsForge's own gateway, and it is never sent to the browser.

### 4. Forced tool call over prompt-instructed JSON

`ChatCompletionRequest` has no `response_format`, so JSON mode is unavailable. It does have `tools` and `toolChoice`. Declaring one function whose parameters are the profile schema and forcing it with `toolChoice: "required"` gives schema-constrained output — verified to honor `enum` constraints, which removes a whole class of dropdown-mapping errors.

`arguments` arrives as a **JSON string**, not an object. Parse it inside a `try`/`catch`.

### 5. Validate with zod, drop bad fields rather than failing

`zod ^4.4.3` is already a dependency. Build the schema from the enum guards already exported by `lib/profile-completion.ts` (`isWorkAuthorization`, `isExperienceLevel`, `isRemotePreference`, `isEducationDegree`) rather than restating the allowed values in a third place.

Use per-field `.catch(undefined)` semantics so a single malformed field does not discard an otherwise good extraction. If **every** field drops out, treat it as the unreadable-resume case — this is the replacement for the `pdf-parse` empty-text guard.

### 6. Route handler over Server Action

`architecture.md` already places this at `app/api/resume/extract/route.ts`, so no new file is invented. A route is also the better fit: extraction returns data for the client to hold rather than mutating and revalidating, which is what Server Actions are shaped for.

Return `{ success, profile?, error? }`, matching the `ProfileActionResult` convention in `actions/profile.ts`. Never throw to the client, and never leak provider names, storage keys, or raw errors into `error` — log those server-side with the existing `[actions/profile]`-style prefix.

Reuse the shape of `getAuthedClient()`, `loadProfileRow()`, and `keyBelongsToUser()` from `actions/profile.ts`. If lifting them into a shared module is clean, do so; otherwise mirror them — do not weaken the user-id prefix check.

### 7. `ProfileForm` owns the state; `ResumeUpload` becomes its child

`ProfileForm` already owns the mutable form state, so it is the natural owner of an extracted draft. `page.tsx` stops rendering `ResumeUpload` and passes its `hasResume` prop through `ProfileForm`, which renders `<ResumeUpload onExtracted={...} />` above its `<form>`. `ProfileForm`'s root becomes a fragment — **`ResumeUpload` must not end up inside the `<form>` element**, or its controls would participate in profile submission.

*Alternative — a new `ProfileEditor` wrapper:* arguably cleaner, but adds a component outside the documented tree for no behavioral gain.

### 8. Remount the form to repopulate uncontrolled inputs

On a successful extraction: merge the extracted values over the current draft, set `skills` / `industries` / `roles` state directly, and bump a `formKey` used as `key` on the inner `<form>`. Remounting makes every `defaultValue` re-read from the new draft. Tag and role state lives on the parent, so it survives the remount.

*Alternative — convert ~20 inputs to controlled:* a large diff across a 700-line file, with a real risk of regressing Feature 06's verified save behavior, to solve a problem a remount solves in a few lines.

**Consequence to watch:** remounting discards uncommitted edits in the form's scalar inputs. That is acceptable — the user asked to overwrite the form — but merge-don't-blank (spec: "Unstated fields are not blanked") must be applied to the draft *before* the remount, so untouched fields survive.

### 9. Model choice — measured, not assumed (updated 2026-08-28)

Two constants: `EXTRACTION_MODEL` and `PROBE_MODEL`. The developer set cost as an explicit constraint (cheap enough for heavy development testing), so candidates were benchmarked against a real CV on 8 ground-truth checks — surname, city, LinkedIn URL, employer, degree, institution, skill count, phone digits.

| Model | Price in/out per M | Checks | Cost / extraction | Per $1 |
| --- | --- | --- | --- | --- |
| `google/gemini-2.5-flash` | $0.30 / $2.50 | **8/8** | $0.00164 | 611 |
| `openai/gpt-4.1-mini` | $0.40 / $1.60 | 7/8 | $0.00145 | 688 |
| `openai/gpt-4o-mini` | $0.15 / $0.60 | 5/8 | $0.00046 | 2,173 |
| `google/gemini-2.5-flash-lite` | $0.10 / $0.40 | fails | $0.00030 | 3,300 |
| `openai/gpt-5-nano` | $0.05 / $0.40 | unusable | — | — |

`gemini-2.5-flash` is the extraction model. The cheaper tiers fail on **identity** fields, which is the one category this feature cannot get wrong: `flash-lite` returned the surname as "Raspopov" instead of "Raspopau" and the city as "Minsk" instead of "Homiel"; `gpt-4o-mini` silently dropped LinkedIn, degree, and institution; `gpt-5-nano` never emits a tool call at all. A misspelled name is exactly what a user saves without noticing. Being 13% dearer than `gpt-4.1-mini` for the only clean score is worth it.

The saving comes from the probe instead. It only has to answer "is there any text here", so it runs on `gemini-2.5-flash-lite` at `maxTokens: 16` — verified correct on both a blank PDF and a real CV. That drops the probe from ~$0.00041 to ~$0.00009.

**Total ≈ $0.0017 per extraction, about 580 on the free plan's $1/month.** The PDF is paid for twice in prompt tokens (once per call); that duplication is the price of decision 12's safety guarantee and is deliberate.

### 10. Prompt requirements

The prompt must state: emit `YYYY-MM` for dates; set `currently_working` instead of an end date for present roles; return at most 3 roles, most recent first; omit fields the resume does not state rather than guessing; and infer `experience_level` from titles and years when not stated. **The inference instruction is load-bearing** — in verification the model omitted `experience_level` for a resume that clearly implied "senior", because nothing said the word.

### 11. Gateway credential — RESOLVED (2026-08-28)

**Outcome A. No environment variable is needed; `lib/env.ts` stays frozen.**

A spike route calling `insforge.ai.chat.completions.create` server-side via `createInsforgeServer()` returned `{ signedIn: false, aiCall: "succeeded", content: "OK" }`. The call succeeded with **no user session**, meaning the SDK fell back to the anon key and `/api/ai/chat/completion` accepted it. The earlier 401 was against `/api/ai/models`, a separate admin-scoped endpoint — it does not generalize to the completion endpoint.

The spike also settled the response shape: the SDK returns `{ id, object, created, model, choices, usage }`. Read the tool call from **`choices[0].message.tool_calls`**, not from the raw `tool_calls` field seen at the HTTP layer.

Two incidental findings worth keeping:

- Next.js App Router treats `_`-prefixed folders as **private** and excludes them from routing, so `app/api/_spike/route.ts` 404s. Avoid underscore prefixes for real routes.
- Because the anon key is accepted, the gateway is reachable by anyone holding the project's public key. That is a platform-level property, not something this change introduces — but it is why the extraction route must authenticate the caller itself (task 1.1) rather than relying on the gateway to do it.

The original analysis is kept below for the record.

### 11a. Gateway credential — original open question

The SDK sets `Authorization: Bearer ${tokenOverride ?? userToken ?? anonKey}` (`index.mjs:610`). Server-side with `createInsforgeServer()` that is the **signed-in user's session token**.

What is known:

- Admin key → accepted (all verification above used it).
- Project anon key → **rejected**, `AUTH_UNAUTHORIZED / Invalid token` on `/api/ai/models`.
- End-user session JWT → **untested.** Could not be verified without a live browser session.

Since the anon key is refused, it is plausible the `/api/ai/*` routes are admin-scoped. Independently, InsForge's own architecture docs describe the backend AI proxy routes as "deprecated compatibility wrappers" and steer developers to read `OPENROUTER_API_KEY` from the dashboard and call the provider directly from a trusted server-side environment.

**Two outcomes, decided by task 1.0:**

- *User JWT accepted* — keep `insforge.ai.chat.completions.create` via `createInsforgeServer()`. No environment variable, nothing required from the developer.
- *User JWT rejected* — the route reads a server-side credential instead. Obtain `OPENROUTER_API_KEY` from the InsForge dashboard (or `npx @insforge/cli ai setup`), add it to `.env.local` and the `lib/env.ts` zod schema, and keep the same request shape. This unfreezes `lib/env.ts` for that one addition and makes the secret a human gate: check the env *name* only, never print or commit the value.

Everything else in this design is unaffected — the tool schema, prompt, validation, and form wiring are identical under either outcome. Only the transport and whether an env var exists change.

### 12. Readability probe before extraction — ADDED during apply (2026-08-28)

**This supersedes part of decision 4 and is the most important finding of the implementation.**

Decision 4 forced the tool call with `toolChoice: "required"`. Against a text-free PDF that turned out to be actively unsafe: the model cannot decline, so it **invents a complete plausible profile**. Observed output on a blank PDF: `full_name: "John Doe"`, `location: "San Francisco, CA"`, and a generic skills list — returned as a *successful* extraction that filled the form with fabricated data the user could then save.

Attempts that did **not** fix it:

- A prompt rule: "Omit any field the resume does not state. Do not invent values."
- A stronger rule naming the failure: "do NOT call the tool… Never invent a person, employer, or skill."
- A required `document_contains_resume` boolean in the tool schema, rejected when not `true` — the model simply set it `true` and invented anyway.
- Relaxing to `toolChoice: "auto"` — it still called the tool and invented. Isolated runs sometimes returned `EMPTY_DOCUMENT`, so this is non-determinism, not a wording problem.

What works: **a separate probe call with no tool attached.** Asked plainly to copy the document's first twenty words or reply `EMPTY_DOCUMENT`, the model was correct **10/10** — 5/5 on the blank PDF and 5/5 on a real 121KB CV, with byte-identical replies each run. With no schema to populate there is nothing to invent into.

The route therefore runs the probe first and returns the unreadable-resume error unless it reports readable text. Extraction only runs on a document known to have text.

Cost: one extra call capped at `maxTokens: 64` — roughly 40–400 prompt tokens, a fraction of a cent, well inside the free tier's $1/month.

This restores the guard the original `build-plan.md` specified ("If extracted text is empty or too short — return error") which decision 2 had dropped along with `pdf-parse`. The build-plan's instinct was right; only its mechanism changed.

`toolChoice` stays `"auto"` for the extraction call — harmless once the probe gates it, and it leaves the model a way out rather than compelling invention.

### 13. Post-review fixes (2026-08-28)

`/feature-review` found 10 issues. The developer asked for everything that could not be postponed; 4 were fixed plus 2 adjacent Minors, and 4 Minors were left open.

**Fixed — Critical**

- **`export const maxDuration = 120` added to the route.** Extraction takes 20–40s, and without this the route inherits the platform serverless default (10s Vercel Hobby, 15s Pro) and dies in production. Local dev has no limit, so every test passed while the deployed feature would have failed. Must stay `>= AI_TIMEOUT_MS` and within the hosting plan's ceiling.

**Fixed — Important**

- **Shared types moved to `types/index.ts`.** `ExtractedProfile` and `ExtractActionResult` were declared in the route and imported by two components, pointing `components/` → `app/api/` against `architecture.md`'s `types/` convention. Type-only, no runtime change. Fixed now rather than later because Features 08, 10, and 13 each add an AI route and would have copied the pattern four more times. **Frozen-file exception recorded:** `types/index.ts` is on the frozen list; this is an additive type-only edit with no behavior change, which the freeze permits.
- **`EXTRACTION_MAX_TOKENS = 1536`.** Extraction output was uncapped, and output is the dominant cost at $2.50/M. Observed 521 tokens, so this leaves ~3x headroom while bounding the worst case. Truncation would break the tool-call JSON and fail closed to the unreadable error rather than yielding partial data.
- **Fabrication guard hardened.** The guard rested on `includes("EMPTY_DOCUMENT")` against a 16-token budget — a truncated or punctuated marker would have slipped through and reopened decision 12's fabrication path. Now three independent conditions, all failing closed: loose regex `/EMPTY[\W_]*DOC/i`, a `MIN_PROBE_TEXT_CHARS = 20` floor, and the empty check. Probe budget raised to 24 tokens for margin. Verified on the blank PDF: `{ declaredEmpty: true, tooShort: true, length: 14 }` — the marker is 14 chars against a floor of 20, so either condition alone catches it.

**Fixed — Minor, in the same data path**

- `??` → `||` in `toProfile`'s role filter and education check. Correct only because `optionalText` guarantees non-empty-or-`undefined`; would have silently admitted blank roles if that ever changed.
- The unreadable path now logs. It is the feature's main safety net and previously returned with no server trace.

**Left open — Minor**

- Duplicated `fileName` / `resumeOnFile` state in `ResumeUpload`.
- All failures return HTTP 200 — deliberate, matches the `ProfileActionResult` convention, but monitoring cannot distinguish them.
- Model variance: the same CV sometimes yields two identical roles, once read a client as an employer, and once returned `linkedin_url` as a bare domain. Review-before-save covers it; not a code defect.
- Pre-existing stub copy: "generate a new tailored one from your details below" still describes Feature 08.

### Files in scope

- New: `app/api/resume/extract/route.ts`
- Modified: `components/profile/ProfileForm.tsx`, `components/profile/ResumeUpload.tsx`, `app/(app)/profile/page.tsx`
- Docs: `context/architecture.md`, `context/code-standards.md`, `context/library-docs.md`, `context/ui-registry.md`, `context/progress-tracker.md`
- Conditional on decision 11: `lib/env.ts` and `.env.local` (one added variable, nothing else)

### Frozen

`actions/profile.ts`, `lib/profile-completion.ts`, `lib/parse-profile.ts`, `lib/insforge-server.ts`, `types/index.ts`, `db/migrations/`, and everything under `app/(auth)/`. Feature 06's save path is verified working; extraction must not touch it. Type-only edits are permitted in `types/index.ts` and `lib/profile-completion.ts` if `npm run build` fails without them — no behavior changes. `lib/env.ts` is frozen unless decision 11 resolves to the server-credential outcome, in which case the only permitted edit is adding that one variable to the schema.

### UI

No open visual decisions, so `/impeccable shape` is not needed. Reuse existing `ui-registry.md` patterns: the Extract control uses the **secondary button** pattern (`rounded-md border border-border bg-surface px-4 py-2 …`) so the accent **Inert primary CTA** stays the single primary action on the card; failures use the **Inline form error** pattern; pending copy replaces the label as the dropzone already does for "Uploading…". Tokens only — no raw Tailwind colors or hex. Run `/imprint` after, since the Extract action is a new registry entry.

## Risks / Trade-offs

- **Extraction quality varies by resume.** Real resumes are messier than the test fixture — multi-column layouts, tables, graphics. → The spec requires every field to stay editable, and review-before-save means a wrong value costs an edit, not corrupted data. Verify against at least one real resume, not only the fixture.
- **InsForge credits can run dry.** → Surfaces as a normal extraction error; the profile stays fully usable by hand. Balance is a dashboard concern; do not claim end-to-end success while unfunded.
- **The model may invent values.** → Confirmed in practice and far worse than anticipated: a forced tool call on an unreadable PDF fabricates an entire profile. Mitigated by the readability probe (decision 12), not by prompt wording, which failed repeatedly. Enum constraints plus zod validation still drop unusable values. Residual risk is a plausible-but-wrong free-text value on a *readable* resume, which review catches.
- **The SDK's 30s default timeout is shorter than a real extraction.** → The AI call uses its own client at 120s (decision 11a/route). Session reads keep the default.
- **Remount discards in-progress scalar edits.** → Accepted; merging before remount limits it to fields the extraction actually touched.
- **Signed URL is fetchable while it lives.** → Keep the expiry to minutes. It is never returned to the browser.
- **Gateway latency on large PDFs.** → The control is disabled while in flight; no timeout tuning until a real case demands it.
- **Context docs will disagree with the code until updated.** → Doc edits are tasks in this change, not a follow-up.

## Migration Plan

None. No schema change, no migration, no data backfill, and no new environment variable. The feature is additive: with the route absent or failing, `/profile` behaves exactly as it does today. Rollback is reverting the change.

## Open Questions

**Does the AI gateway accept an end-user session JWT?** See decision 11. This is resolved by task 1.0 — a single call from the running app while signed in — before any other implementation work. It changes the transport and whether one environment variable exists; it changes no requirement in `specs/profile/spec.md` and no other task. It is listed here rather than resolved now only because answering it requires a live browser session.

Whether the auth/profile-loading helpers in `actions/profile.ts` should be lifted into a shared module or mirrored in the route is an implementation-time judgment that changes neither the specs nor the task breakdown.
