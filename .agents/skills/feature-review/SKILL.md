---
name: feature-review
description: The project's custom 3-layer review, run as an adversarial reviewer by default. After building a feature, try to break it — verify it matches what was planned, respects the system architecture and design standards, and is ready for production. Reports issues clearly so the developer decides what to fix. Use this (NOT Bugbot or Security Review) when the user types /feature-review, /review, or asks for the project review, 3-layer review, or a review before demo.
---

Building is not done when the code runs. It is done when the code is correct.

AI moves fast. Fast means things get built that work on the surface but drift from the architecture, violate the design system, or miss edge cases that matter. This skill catches those things before they compound into bigger problems.

Run this after every feature. Before you move on. After `/opsx-apply` and before `/opsx-archive`.

## The Stance — Adversarial by Default

This review is adversarial unless the developer explicitly asks for a light pass. You are not confirming the work. You are trying to break it.

The default failure mode of an AI reviewer is agreeableness: it reads the code, sees intent, reconstructs the author's reasoning, and reports PASS. That review is worthless — it only proves the code is self-consistent. Self-consistent code ships bugs every day.

So invert the burden of proof:

- **Assume every layer is broken until you have evidence it is not.** PASS is a conclusion you earn by attacking, not a default you fall back to when nothing jumps out.
- **Read the code, not the commit message.** Never accept a plan doc, a progress-tracker entry, a code comment, or a prior session's `memory.md` as evidence that something works. Those record what the author *believed*. Verify against the source, the schema, and where possible a real run.
- **Distrust the author's own verification most of all.** "Verified live", "tested end to end", and "all checks pass" are claims to audit, not findings to repeat. Ask what the test would have done if the feature were broken. If the answer is "passed anyway", the verification is worthless — say so.
- **Hunt the second-order failure.** The first-order bug is usually already fixed. Ask instead: what happens on the second call, the concurrent call, the call from a different user, the call after a partial failure, the call with the field empty rather than absent.
- **Trace one real path end to end per feature.** Pick the user's actual sequence and follow the data through every layer — form → action → validation → DB → read-back → render. Bugs live in the seams between correct components, not inside them.
- **Attack the boundaries you were told are safe.** A guard the author is proud of is the highest-value target: gates, ownership checks, completion checks, in-flight locks, idempotency. Ask specifically how to get past it, then check whether that path exists.
- **Name the exact input that breaks it.** An adversarial finding is a reproduction, not a worry. "This may not handle bad data" is not a finding. "A profile whose `phone` is an empty string passes the completion gate but renders a blank contact line" is.

What adversarial does **not** mean:

- Not manufacturing issues to look thorough. A padded report is as useless as an empty one — it trains the developer to skim.
- Not restyling working code to taste. Preference is not a defect.
- Not speculative fear. If you cannot name the input, the caller, or the doc that proves it, it is a question — label it as one and put it under Open questions, not under an issue severity.

When a layer genuinely survives, say what you attacked and why it held. A PASS with no attack recorded is not a PASS, it is an unread layer.

## What This Skill Does Not Do

It does not fix anything. It reports what it finds and lets the developer decide what matters and what to do about it. Fixing without understanding is how problems get buried, not solved.

---

## Step 1 — Understand What Should Have Been Built

Before reviewing anything, establish the benchmark.

Read in this order:

- The OpenSpec change under `openspec/changes/<id>/` if one exists — `proposal.md`, `specs/`, `design.md`, `tasks.md`
- The implementation plan from `/architect` if one exists and no OpenSpec change covers this work
- The feature description or task that was given
- Any relevant context files — architecture boundaries, code standards, design rules

If no plan exists, ask the developer to describe what the feature was supposed to do before reviewing. You cannot verify correctness without knowing what correct looks like.

**Single feature (default):** one OpenSpec change or architect plan, one feature, this template as written.

**Phase or program review:** when the user asks to review a phase, all progress so far, or several completed items, do not force a single-feature report. Use the build plan and progress tracker as the benchmark. Report each completed item briefly (Layers 1–3), then one cross-cutting summary.

---

## Step 2 — Review in Three Layers

### Layer 1 — Does it match the plan?

Compare what was built against what was planned.

Check:

- Every part of the feature description — is it all there?
- The decisions made during planning — are they reflected in the code?
- The scope — did the implementation stay within bounds or add things that were not asked for?
- Leftover stub copy — search product UI (not docs) for phrases like "not yet", "not connected", "coming soon". A shipped path whose user-facing copy still describes the previous stub is **Important**, even when the new code path works.

Flag anything that was planned but missing. Flag anything that was built but not planned.

### Layer 2 — Does it respect the system?

This is where AI drift most commonly happens. The feature works, but it violates rules that the project depends on.

Check:

- **Architecture boundaries** — does code in the right place own the right responsibilities? No UI logic in API routes. No DB calls in components. Whatever the project's boundaries are — are they respected?
- **Design system** — are the correct tokens, classes, and patterns used? Any hardcoded values that should be variables? Any raw color classes that should use the design system?
- **Code standards** — naming conventions, file organisation, TypeScript strictness, error handling patterns — do they match what the project established?
- **Existing patterns** — does this feature introduce a new pattern when an existing one should have been used?

### Layer 3 — Is it production ready?

Check:

- Error handling — what happens when things go wrong? Are errors caught and handled or does the feature silently fail?
- Edge cases — empty states, loading states, missing data — are these handled?
- Console errors — any errors or warnings in the browser or terminal?
- Obvious bugs — anything that would clearly break for a real user?
- Inferred orphans / missing cleanup — a missing API call in source is not proof of a user-visible bug. Confirm against official docs and the path the user actually ran before calling it Important. Prefer an existing delete helper over a new job or trigger.

---

## Step 3 — Report What You Found

After completing all three layers, produce a clear report. Do not bury issues. Do not soften them. Report honestly so the developer can make informed decisions.

```
## Review — [Feature Name]

### Layer 1 — Plan alignment
[PASS / ISSUES FOUND]
[List any gaps between what was planned and what was built]

### Layer 2 — System integrity
[PASS / ISSUES FOUND]
[List any architecture, design, or code standard violations]

### Layer 3 — Production readiness
[PASS / ISSUES FOUND]
[List any error handling gaps, edge cases, or obvious bugs]

### Attacked and held
[What you specifically tried to break and why it survived. One line each.
A layer marked PASS with nothing listed here is an unread layer, not a clean one.]

### Open questions
[Things you suspect but cannot prove — no severity label, because a question
is not a finding. Say what evidence would settle each one.]

### Summary
[X] issues found across [Y] layers ([N] Critical, [N] Important, [N] Minor).

[If no issues: "Nothing survived review as a defect. Here is what I attacked: ..."
Never write "No issues found" without that list.]
[If issues: "Resolve the above before moving to the next feature."]
```

---

## Step 4 — Let the Developer Decide

After presenting the report, stop. Do not start fixing. Do not suggest fixes unless the developer asks.

Wait for the developer to:

- Ask you to fix a specific issue
- Tell you an issue is intentional and can be ignored
- Confirm everything is resolved and ready to move on

The developer owns the quality decision. You inform it.

After they triage (keep / skip / Important only / named Minors), that list is the implementation scope. Do not fix remaining Minors "while you are here" unless they block the named work.

---

## Severity Guide

Not all issues are equal. Use this to help the developer prioritise:

**Critical — fix before moving on**

- Architecture boundary violations that will break future features
- Missing error handling that causes silent failures
- Functionality that was planned but completely missing

**Important — fix soon**

- Design system drift that will cause UI inconsistency
- Code standard violations that will compound across the codebase
- Edge cases that a real user will encounter

**Minor — fix when convenient**

- Naming inconsistencies that do not affect behaviour
- Missing optimisations
- Style issues that do not affect the design system

Label each issue with its severity so the developer can triage quickly.

**Evidence bar per severity.** Severity is a claim about consequence, so it needs proportional proof. Critical and Important require a concrete trigger — the input, the sequence, or the caller that reaches the defect, plus the observable result. If you cannot supply that trigger, the finding is either a Minor or an Open question; do not promote a hunch by labelling it loudly.

---

## The Standard

The question this skill answers is not "does it work?"

The question is "is it correct?"

Working and correct are not the same thing. A feature can work today and break the project tomorrow. Review exists to catch the difference.

And a review that agrees with the build is not a review. If you finish a pass having found nothing and attacked nothing, you have not reviewed the feature — you have read it.
