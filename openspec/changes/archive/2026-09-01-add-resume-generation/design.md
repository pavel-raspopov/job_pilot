## Context

See `proposal.md` — Why. This section records only the constraints that shape the approach.

**What already exists.** Feature 06 persists the profile and uploads a CV to `resumes/{user_id}/resume.pdf`, tracked by `profiles.resume_pdf_url` / `resume_pdf_key`. Feature 07 built `app/api/resume/extract/route.ts`, which is the working reference for an AI route in this codebase: authenticate, re-check the storage key's user prefix, mint a short-lived signed URL, call the InsForge AI gateway with a forced tool call, validate with zod, return `{ success, profile?, error? }` and never throw. `lib/profile-completion.ts` owns the 12-field completeness check that both `is_complete` and the attention banner already use. The Resume card's "Generate Resume from Profile" button exists and is disabled.

**What Feature 07 learned the hard way**, and this route inherits:

- `export const maxDuration = 120` is mandatory. Without it the route inherits the 10s serverless default and dies only in production, because dev has no limit.
- The SDK's HTTP client times out at 30s — too short for a real model call. AI calls need their own client at 120s; session reads keep the default.
- The gateway has no `response_format`. Forced tool calls are the only structured-output route, and `arguments` arrives as a JSON **string** that must be parsed inside try/catch.
- The SDK normalizes gateway responses to OpenAI shape: read `choices[0].message.tool_calls`.
- Output tokens dominate cost. Cap with `maxTokens`.

**Verified during design, against installed sources rather than recollection:**

- `@react-pdf/renderer@4.9.0` declares `react: ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0` — React 19 is in range.
- `@react-pdf/renderer` is **already in Next.js's default `serverExternalPackages` list** (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`). The approved plan called for adding that entry; it is redundant. (`next.config.ts` did end up changing, but for an unrelated reason discovered later — see decision 10.)
- The SDK's storage signature is `upload(path: string, file: File | Blob)`. It does **not** accept a Node `Buffer`, which is exactly what `renderToBuffer` returns.
- The same doc comment states "Standard PUT semantics: uploading to an existing key replaces the [object]". Regeneration overwrites for free; there is no `upsert` flag to pass.
- `createSignedUrl(path, expiresIn?)` is the private-bucket read path, as used by extraction.

**Blocked at design time.** The InsForge MCP server failed to connect (`CONNECTION_CLOSED`), so `run-raw-sql` and `get-table-schema` are unavailable. The migration cannot be applied or confirmed until that is resolved or `npx @insforge/cli` is used instead.

## Goals / Non-Goals

**Goals:**

- Produce a downloadable single-page PDF from the stored profile, with prose the user did not have to write.
- Guarantee the uploaded CV survives generation — the extraction path must be provably unaffected.
- Reuse Feature 07's route shape rather than inventing a second AI convention, and factor out the one piece both routes need.
- Keep `components/profile/` at the four filenames `context/architecture.md` lists.

**Non-Goals (design level; product-level exclusions are in `proposal.md`):**

- No streaming or progress reporting beyond a pending button state.
- No client-side PDF rendering. `@react-pdf/renderer` never reaches a client bundle.
- No caching layer or generated-document staleness tracking. Every click regenerates.
- No refactor of `ProfileForm`'s uncontrolled-input/`formKey` arrangement. Feature 07 chose it deliberately to avoid rewriting Feature 06's verified save path; this change threads one boolean prop and touches nothing else there.

**In scope:** `app/api/resume/generate/route.ts` (new), `app/api/resume/generate/resume-document.tsx` (new), `lib/insforge-ai.ts` (new), `db/migrations/003_add_generated_resume.sql` (new), `types/index.ts`, `lib/parse-profile.ts`, `components/profile/ResumeUpload.tsx`, `components/profile/ProfileForm.tsx`, `app/(app)/profile/page.tsx`, `app/api/resume/extract/route.ts` (import swap only), and the five `context/` docs listed in the proposal.

**Frozen:** `actions/profile.ts`, `lib/profile-completion.ts`, `lib/insforge-server.ts`, `lib/env.ts`, `app/globals.css`, and every extraction behavior in `app/api/resume/extract/route.ts` beyond the client import. One-line type or compile fixes only, and only if `npm run lint` or `npm run build` fails.

`next.config.ts` started on this list and came off it — see decision 10 for the reason and the alternative that was weighed.

## Decisions

### 1. Two storage slots, two column pairs

`resumes/{user_id}/resume.pdf` stays the uploaded source; `resumes/{user_id}/generated-resume.pdf` holds the generated document, tracked by new `generated_resume_url` / `generated_resume_key`.

*Alternative considered — the build plan's single slot with `upsert: true`.* Rejected because `resume_pdf_key` is the exact key extraction reads. One generation would delete the user's CV and turn "Extract from Resume" into a loop over the model's own output, degrading a little more each round. The build plan predates Feature 07 and could not have anticipated it.

*Alternative considered — a second slot with no columns, returning only a signed URL.* Rejected: the link dies on reload with nothing recording that a document exists, and a future dashboard tile or job application flow would have no way to find it. Two nullable columns are cheap.

### 2. One AI call, forced tool call, no readability probe

Extraction runs a probe first because its input is an opaque PDF the model might not be able to read — and Feature 07 established that a forced tool call over unreadable input makes the model invent a person. That risk does not exist here: the input is our own `profiles` row, already validated by `parseProfileRow`. If the row is thin, the completeness gate has already refused. So generation is a single call with `toolChoice: "required"` and a `record_resume` tool.

The tool returns only the *rewritten* parts — a summary paragraph and per-role bullet arrays keyed by role index. Names, employers, titles, dates, institutions, and skills are **not** round-tripped through the model; they go from the profile row into the PDF directly. This is the structural version of "do not invent facts": the model is never handed the opportunity, because the fields it could corrupt are not in its output schema.

*Alternative considered — have the model return the whole resume document.* Rejected. It is the shape that produces misspelled names and drifted employers, and Feature 07 already measured cheaper models doing exactly that.

### 3. Every AI-produced section falls back to stored text

Validate the tool output with zod, field-by-field `.catch(undefined)`, mirroring `extractionSchema`. When the summary is missing, omit the summary section. When a role's bullets are missing or empty, render that role's stored `responsibilities` text verbatim. A failed rewrite degrades to a plain-but-correct resume; it never blocks the download and never leaves a hole.

### 4. Model choice is measured, not assumed

Start from `google/gemini-2.5-flash` — Feature 07's benchmarked winner — and check one cheaper tier on the real fixture profile before committing. Record the comparison in a route-level comment the way the extract route does, so the next person sees the evidence rather than a bare constant. This is prose rewriting rather than identity extraction, so a cheaper tier may well hold up; the point is to find out rather than guess in either direction.

### 5. `renderToBuffer` output is wrapped before upload

`renderToBuffer` returns a Node `Buffer`; `upload()` takes `File | Blob`. Wrap once: `new File([buffer], "generated-resume.pdf", { type: "application/pdf" })`. Both globals exist in the Node 18+ runtime Next 16 targets. Then re-check the returned key's user prefix with the same `keyBelongsToUser` guard the extract and upload paths use, before persisting anything.

### 6. Download is a fresh signed URL, never the stored one

The `resumes` bucket is private, so `generated_resume_url` is a record, not a fetchable link. The route returns a 300-second signed URL as `downloadUrl`, exactly as extraction mints one for the gateway. The UI must not imply the link is permanent — on reload the user clicks Generate again.

### 7. The PDF document lives beside its route

`app/api/resume/generate/resume-document.tsx`. `context/library-docs.md` restricts PDF rendering to `app/api/resume/` and forbids importing the library from a client component; colocation satisfies both and keeps `components/profile/` at four files. Next.js supports colocated non-route files inside `app/`.

*Alternative considered — `lib/resume-pdf.tsx`.* Rejected: `lib/` is imported freely from client components in this codebase, so it is the one place a future accidental client import would not look wrong.

### 8. Feature 07's AI client factory moves to `lib/insforge-ai.ts`

`createAiClient()` and `AI_TIMEOUT_MS` are currently private to the extract route. Features 10 and 13 need the same 120-second client. Lift them now, while there is exactly one caller to keep honest, and have the extract route import them. Pure move — no signature or behavior change. `lib/insforge-server.ts` stays frozen; its 30-second default is correct for session reads and must not be loosened.

### 9. The completeness gate reuses `getProfileCompletion`

Both sides call the same function. The server calls it on the loaded row and refuses when `isComplete` is false; the page passes `profile?.is_complete` down to the button. Reusing the existing helper means the gate can never drift from the attention banner that tells the user which fields are missing — the button says "complete your profile", the banner says which ones.

### 10. Bundled Inter, because Helvetica measurably broke the document

**Resolved during implementation — the built-in font was worse than expected.** Rendering a probe document and decoding the PDF's own text operators showed Helvetica failing three ways, all silent:

| Input | Helvetica rendered |
| --- | --- |
| `Павел Распопов` | `025;` / ` 0A?>?>2` — **mangled into garbage, not blank** |
| `•` (bullet marker) | dropped entirely — every bullet in the resume invisible |
| `—` (date separator) | dropped — `Jan 2021  Present` |
| `José Ferreira-Lühr` | fine (Latin-1 is covered) |

The bullet and dash losses hit **every** resume, not only non-Latin ones, so "record the limitation and ship" was not viable.

Inter Regular + SemiBold (SIL Open Font License) are bundled at `app/api/resume/generate/fonts/` and registered with `Font.register`. Inter is already the app's typeface via `next/font`, so the PDF matches the product. Verified after the change: all four rows render correctly, **and** pdf.js text extraction returns the strings character-perfect — which matters because applicant tracking systems parse resumes as text.

Loaded from disk by path rather than inlined as base64: 635KB of font becomes ~850KB of base64 in source otherwise. `Font.registerHyphenationCallback` is overridden to return words whole; the default breaks them mid-glyph.

**Scope deviation, recorded rather than absorbed:** this required adding `outputFileTracingIncludes` to `next.config.ts`, which the Goals section lists as frozen. Nothing imports the TTFs, so Next's file tracing cannot infer them and the serverless bundle would ship without them — working in dev and failing only in production, the exact trap `maxDuration` set in Feature 07. The alternative (base64 inlining) avoids the config change at a real cost to every build.

### 11. No new component files, no new PostHog event

`components/profile/` stays at `ProfileForm` / `ResumeUpload` / `ResumePreview` (still unbuilt) / `CompletionIndicator`. `context/code-standards.md` fixes the product event list at four; no `resume_generated` event.

## Risks / Trade-offs

**The migration cannot be applied — InsForge MCP is down.** → Task 1 is a hard gate: restore the MCP connection or apply `003` via `npx @insforge/cli`, and confirm with a schema read before any code reads the new columns. No end-to-end claim until then.

**The model rewrites a fact anyway, inside a bullet.** → Decision 2 keeps structured facts out of the model's output entirely, so the blast radius is prose only. The proposal's non-invention scenario is a verification step against the fixture profile, not an assumption.

**Generation is slow and the route is killed in production.** → `maxDuration = 120`, and verification records actual wall-clock time. One text completion should beat extraction's parse-plus-two-calls, but it is measured rather than asserted. `maxDuration` must also fit the hosting plan's ceiling, which is still unverified because nothing is deployed.

**Content overflows one page.** → Three roles is the form's cap and skills are short strings, so the realistic worst case is bounded. Cap bullets per role in the tool schema and constrain summary length. If a maximal profile still spills, the second page is acceptable — a truncated resume is worse than a two-page one.

**Non-Latin names render blank.** → Decision 10; caught by reading the actual PDF rather than by trusting the render to succeed.

**Storage cost doubles per user.** → Two PDFs of a few hundred KB each. Not material at this stage; noted so it is a known trade rather than a surprise.

**Extraction regresses via the client-factory move.** → Behavior-neutral by construction, and verification re-runs a full extraction after the move rather than assuming an import swap is safe.

## Migration Plan

1. Apply `db/migrations/003_add_generated_resume.sql` — two nullable `text` columns on `profiles`. Existing RLS covers them; no policy change.
2. Confirm with `get-table-schema` (MCP) or the CLI equivalent.
3. No backfill. Both columns are null until a user generates, and every read path treats null as "no generated resume".

**Rollback:** the columns are additive and nullable, so old code ignores them. To reverse, drop the two columns and delete `resumes/{user_id}/generated-resume.pdf` objects. Nothing in the uploaded-resume or extraction paths depends on them, so a rollback cannot strand existing data.

## Open Questions

- **Cheaper model for prose rewriting?** Decision 4 settles the method (measure before committing); the outcome is deferrable because either result produces the same code with a different constant.
- ~~Does the fixture profile need a Unicode font?~~ **Answered during implementation: yes, and for more than names.** See decision 10.
