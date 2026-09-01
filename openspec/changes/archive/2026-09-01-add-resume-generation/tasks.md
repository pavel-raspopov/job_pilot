> **Status 2026-09-01 — 45/45 done.** Ready for /opsx-archive.
>
> Migration applied. Full happy path, both negative branches, the non-destructive
> guarantee, and the rewrite-failure fallback all verified against the real backend
> and a real profile. /feature-review found 4 issues (group 9); the developer's own read of the
> generated PDF found 5 more (group 11). All resolved.
>
> `lint`, `build`, `check:agents`, `check:sync`, and both openspec validations
> pass — `check:agents` green for the first time this session, after the
> AGENTS.md merge in group 10.
>
> **Twelve defects were caught by verifying rather than reviewing**, none of which lint,
> build, or TypeScript could see: Helvetica silently mangling Cyrillic and dropping
> every bullet and em dash; the name overlapping the title; headings extracting as
> "S U M M A RY" and defeating ATS parsing; a double click firing two billed AI calls;
> a 43-skill list spilling to a second page; a 938-character paragraph rendering as one
> wall-of-text bullet; the model returning a whole role as a single bullet; the bullet
> cap not surviving the sentence split; and ASCII-only splitting that would have left
> non-Latin profiles broken; a bullet cap that dropped a real achievement; a
> splitter that shredded good bullets so the cap could eat the remains; and
> semicolon-separated responsibilities that would not split at all.
>
> One more came from the developer reading the document rather than the tests:
> both work-history roles carried the same start date. That was Feature 07 data,
> not a generation bug — corrected in the profile, and a standing reminder that
> extraction gets dates wrong often enough for review-before-save to matter.
>
> Gate tests 5.2 and 6.3 were run by temporarily inverting the branch in code, not by
> nulling a field on the real profile — the classifier refused that UPDATE, and saving
> through the UI would have rewritten 43 skills and two 900-character role descriptions
> from form state to test three lines. Branch tests, not end-to-end. Both files were
> restored and hash-checked against their backups.

## 1. Unblock the database (hard gate)

- [x] 1.1 Restore the InsForge MCP connection, or confirm `npx @insforge/cli` can reach the project. Verify: a successful `get-table-schema` (or CLI equivalent) read of `profiles`. **Nothing below may proceed on an unverified schema.**
- [x] 1.2 Write `db/migrations/003_add_generated_resume.sql` adding nullable `generated_resume_url` and `generated_resume_key` text columns to `public.profiles`, with a header comment matching the style of `db/migrations/002_add_resume_pdf_key.sql`. Verify: the file exists and states why the columns are separate from `resume_pdf_*`.
- [x] 1.3 Apply the migration via MCP `run-raw-sql` or the CLI. Verify: `get-table-schema` on `profiles` shows both new columns as nullable text, and existing rows are untouched.

## 2. Dependency and shared AI client

- [x] 2.1 Install `@react-pdf/renderer@^4.9.0`. Verify: it appears in `package.json` dependencies and `npm run build` still passes. Do **not** add `serverExternalPackages` to `next.config.ts` — design decision, verified: the package is already in Next.js's default externals list.
- [x] 2.2 Create `lib/insforge-ai.ts` exporting `AI_TIMEOUT_MS` and `createAiClient()`, moved verbatim from `app/api/resume/extract/route.ts` (lines ~72–96), including the comment explaining why session reads keep the SDK's 30s default. Verify: `npm run lint` and `npm run build` pass.
- [x] 2.3 Replace the extract route's local factory with an import from `lib/insforge-ai.ts`. Verify: `npm run build` passes **and** a real extraction still succeeds end to end in the browser — an import swap is not assumed safe.

## 3. Types and parsing

- [x] 3.1 In `types/index.ts`, add `generated_resume_url: string | null` and `generated_resume_key: string | null` to `Profile`, and add `GenerateActionResult = { success: boolean; error?: string; downloadUrl?: string }` beside `ExtractActionResult`, with a doc comment noting the URL is short-lived. Verify: `npm run build` surfaces every read site that needs updating; fix them.
- [x] 3.2 In `lib/parse-profile.ts`, parse both new columns with `asNullableString`. Verify: `npm run build` passes and `/profile` still renders for a profile row that predates the migration (both values null).

## 4. The PDF document

- [x] 4.1 Create `app/api/resume/generate/resume-document.tsx` exporting a `ResumeDocument` component taking the stored profile plus optional rewritten prose (summary string, bullets per role index). Single A4 `Page`, `StyleSheet.create` only, and only the CSS properties listed as supported in `context/library-docs.md`. Verify: `npm run build` passes and the file has no `"use client"`.
- [x] 4.2 Render header (name, current title, contact line from email/phone/location/LinkedIn/portfolio), summary, work experience, education, and skills. Omit any section the profile leaves empty — no blank headings, no placeholder text. Fall back to a role's stored `responsibilities` when no bullets are supplied. Verify: covered by the manual checks in task 7.

## 5. The generation route

- [x] 5.1 Create `app/api/resume/generate/route.ts` with `export const maxDuration = 120` and a comment stating why (Feature 07's production-only failure mode). Authenticate via `createInsforgeServer()`, load the row, and `parseProfileRow` it. Verify: signed-out POST returns the auth error as JSON, not a stack trace.
- [x] 5.2 Gate on completeness server-side using `getProfileCompletion(profile).isComplete` — do not reimplement the check. Refuse with a distinct message when there is no profile row at all. Verify: POST with an incomplete profile returns the gate error and writes nothing.
- [x] 5.3 Add the `record_resume` forced tool call (`toolChoice: "required"`) whose schema covers **only** rewritten prose — a summary and per-role bullet arrays. Structured facts must not appear in the tool schema (design decision 2). Cap output with `maxTokens` and cap bullets per role in the schema.
- [x] 5.4 Parse `choices[0].message.tool_calls[0].function.arguments` as a JSON string inside try/catch, then validate with a zod schema using field-by-field `.catch(undefined)`. Every failure path falls back to stored profile values rather than aborting (design decision 3). Verify: a forced-failure run (temporarily bad model id) still produces a correct plain PDF.
- [x] 5.5 Benchmark `google/gemini-2.5-flash` against one cheaper tier on the real fixture profile, then set the model constant and record the comparison in a route-level comment, as `EXTRACTION_MODEL` does. Verify: the comment names both models, what was compared, and the measured per-generation cost.
- [x] 5.6 `renderToBuffer(<ResumeDocument … />)`, wrap the Buffer as `new File([buffer], "generated-resume.pdf", { type: "application/pdf" })` — `upload()` takes `File | Blob`, not `Buffer` — and upload to `resumes/{userId}/generated-resume.pdf`. Re-check the returned key with a `keyBelongsToUser`-style guard before persisting. Verify: the object appears in the bucket under the user's prefix.
- [x] 5.7 Persist `generated_resume_url` / `generated_resume_key`, mint a 300-second `createSignedUrl`, and return `{ success: true, downloadUrl }`. Every error path returns `{ success: false, error }` with no internal detail, provider name, or storage path. Verify: the returned URL downloads the PDF; the stored URL alone does not (private bucket).

## 6. UI

- [x] 6.1 Thread `isProfileComplete` from `app/(app)/profile/page.tsx` → `ProfileForm` → `ResumeUpload`, exactly as `hasResume` is threaded today. Verify: `npm run build` passes; no other `ProfileForm` behavior changes.
- [x] 6.2 In `components/profile/ResumeUpload.tsx`, make the footer CTA live: `onClick` posts to `/api/resume/generate`, label swaps to "Generating…", disabled while in flight. Tokens only — no raw Tailwind colors or hex. Verify: clicking twice quickly starts one request.
- [x] 6.3 When `isProfileComplete` is false, keep the button disabled and change the row's prompt copy to point at the attention banner. **Amended during implementation:** the task originally said to use the **Inert primary CTA** classes. Built with the ordinary `disabled:opacity-60 disabled:cursor-not-allowed` variants on a real `disabled` button instead — a genuinely disabled control is announced to assistive tech, where a permanently-styled fake one is not, and it also covers the in-flight state with one class list. That left the Inert primary CTA pattern with zero users; it is retired in `ui-registry.md`. Verify: an incomplete profile shows the disabled state and clicking does nothing.
- [x] 6.4 On success render a Download link (secondary button pattern, `Download` icon from `lucide-react`) opening `downloadUrl` in a new tab. Copy must not imply the link is permanent. Errors use the existing **Inline form error** pattern (`text-sm text-error`, `role="alert"`). Verify: the link downloads a PDF; after reload the link is gone and Generate is the way back.
- [x] 6.5 Run `/imprint` to record the live Generate CTA + Download link row in `context/ui-registry.md`, and retire the "until Feature 08" caveat on the **Inert primary CTA** entry. Verify: the entry describes the shipped state, not the planned one.

## 7. Verification

- [x] 7.1 Run `npm run lint`, `npm run build`, `npm run check:agents`, `npm run check:sync`, and `openspec validate --specs --strict`, showing output for each.
- [x] 7.2 Manual happy path on `/profile`: complete and save a profile, click Generate, download the PDF. Confirm one page, and that the name, title, contact line, roles, education, and skills match the saved profile.
- [x] 7.3 Non-invention check: compare every employer, title, date, institution, degree, and skill in the PDF against the stored profile. Any fact not in the profile is a defect, not a nice bonus.
- [x] 7.4 **Non-destructive check** — the regression the storage decision exists to prevent. After generating, confirm `resume_pdf_key` still points at `{user_id}/resume.pdf`, both objects exist under `resumes/{user_id}/`, and "Extract from Resume" still extracts the *uploaded* CV.
- [x] 7.5 Font check: read the rendered PDF for a profile containing the fixture's real name. If any glyph is missing, register a Unicode TTF via `Font.register`; otherwise record the Latin-1 limitation in `context/library-docs.md`.
- [x] 7.6 Negative paths: signed out; no profile row; incomplete profile; regenerate twice and confirm only one generated object remains.
- [x] 7.7 Record wall-clock generation time against `maxDuration = 120`. If it is close, say so — that is a pre-deploy blocker, not a footnote.

## 8. Docs and close-out

- [x] 8.1 `context/architecture.md`: add the `generated-resume.pdf` storage row, both `profiles` columns, narrow the `resume_pdf_url` description to the uploaded resume, and note why `ResumePreview.tsx` is still unbuilt. Verify: no stale claim that one path holds "the" resume.
- [x] 8.2 `context/library-docs.md`: correct the react-pdf upload path, state that `serverExternalPackages` is **not** needed (already a Next.js default), document the Buffer→`File` wrap and the private-bucket signed-URL download, and record the font finding from 7.5.
- [x] 8.3 `context/build-plan.md`: add the reconciliation note on Feature 08's single-slot `upsert` instruction and why it was not followed.
- [x] 8.4 `context/progress-tracker.md`: mark 08 complete, set Next to 09, and add the decision block covering the storage split, the facts-out-of-the-model schema, and the two verified Next.js/SDK findings.
- [x] 8.5 Run `/feature-review`, then `/opsx-archive`. Run `/remember save` and stage `memory.md` with the commit — never as a follow-up.

## 9. Post-review fixes

`/feature-review` found 4 issues (0 Critical, 1 Important, 3 Minor). All resolved.

- [x] 9.1 **Important — bullet cap was not enforced on output.** `toProse` sliced to `MAX_BULLETS_PER_ROLE` and `bulletsFor` then split long bullets into sentences, so 4 could render as 6+ — the mechanism behind the earlier two-page spill. Moved the cap after the split. The constant now lives in `resume-document.tsx` and is imported by the route, so the prompt, the tool schema, and the renderer cannot drift. Verified: 2 consecutive generations, exactly 8 bullets, 1 page.
- [x] 9.2 **Minor — sentence splitting was ASCII-only.** `(?=[A-Z])` never fires for Cyrillic or Greek, so a non-Latin profile would still render one wall-of-text bullet — precisely the users the bundled Inter font was added for. Now `(?<=[.!?。！？])\s+(?=\p{Lu}|\p{Lo})/u`.
- [x] 9.3 **Minor — a generated resume was invisible after reload.** The columns were written but never read, so returning users had to pay for another model call to reach an existing document. Added `GET /api/resume/generate`, which mints a fresh signed URL without regenerating; `ResumeUpload` fetches it on mount when `hasGeneratedResume`. Auth and profile loading are now shared by both verbs. Verified: reload offers Download with no POST.
- [x] 9.4 **Minor — `updated_at` bumped on generation. Closed as no-change, deliberately.** Generating is not a profile edit, but `uploadResume` already bumps it when writing its own storage pointers, so the column means "row last written". Making this one path the exception would be the inconsistency. Documented in the route instead.

## 10. AGENTS.md merge

- [x] 10.1 Restored the project's AGENTS.md from HEAD (InsForge tooling had replaced all 125 lines with its SDK boilerplate) and merged in a condensed `## InsForge SDK notes` section — 39 lines carrying the useful parts of the boilerplate's 136: the `fetch-docs` / `fetch-sdk-docs` tool list, the SDK-vs-MCP split, and the gotchas that cost real time.
- [x] 10.2 Recorded the four boilerplate claims that are **wrong for this project**, so a future overwrite re-applies advice this file already refutes: Tailwind 3.4 (this is v4), calling OpenRouter directly with an `OPENROUTER_API_KEY` (Feature 07 chose the InsForge gateway and needs no such key), `download-template` as mandatory (the project exists), and `createClient` setup (already in `lib/`). Verified: `npm run check:agents` reports **intact** — green for the first time this session.

## 11. Fixes from developer review of the generated document

Found by reading the PDF as a document rather than as test output — neither was visible to any automated check.

- [x] 11.1 **An achievement was being dropped.** `MAX_BULLETS_PER_ROLE = 4` silently cut the fifth and sixth achievements from a role that listed six, so the resume was less impressive than the profile it was built from. Raised to 6 — a ceiling, not a target. Verified: all 6 render, one page, with room left.
- [x] 11.2 **The splitter was shredding good bullets, then the cap ate the remains.** Task 9.1 moved the cap after the split, which fixed overflow but introduced content loss: four rich bullets became six fragments and the cap trimmed back to four, losing the tail of the last real one. Splitting is now a rescue for one specific failure — exactly one returned element, long enough to be a blob — instead of a general pass.
- [x] 11.3 **Semicolon-separated responsibilities were not split.** The profile form takes free text and the developer's own profile uses `A; B; C`; the splitter only knew `.!?`, so the fallback path would have produced one wall-of-text bullet. Now handles both.
- [x] 11.4 **Prompt asked for a fixed count.** "Write 6 bullets" invites padding or dropping. Now: one bullet per distinct achievement, cover every one, keep the technologies, numbers, and percentages.
- [x] 11.5 **Stored data, not a generation bug: both roles started 2021-11.** Feature 07's extraction produced two roles with the same start date — the variance `memory.md` already flags. The generator rendered it faithfully. Corrected the current role to `2022-09` per the developer. Resume now reads `Nov 2021 — Aug 2022` then `Sep 2022 — Present`. **Worth carrying into Feature 10/13: extraction gets work-history dates wrong often enough that review-before-save is load-bearing, not a nicety.**
