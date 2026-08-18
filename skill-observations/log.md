# Skill Observation Log

Observations captured during task-oriented work.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = skill
updated/created | DECLINED (YYYY-MM-DD) = user decided not to pursue —
resolved statuses always carry their resolution date

---

## 2026-07-31

### Observation 1: Impeccable context.mjs fails on unquoted Next.js route-group paths

**Status:** ACTIONED (2026-07-31) — Added quoting note for `--target` in `.cursor/skills/impeccable/SKILL.md` Setup step 1.
**Date:** 2026-07-31
**Session context:** Feature 05 Profile Page — running `/impeccable shape` setup
**Skill:** impeccable
**Type:** open-source
**Phase/Area:** Setup step 1 (`scripts/context.mjs` invocation)

**Issue:** `node .cursor/skills/impeccable/scripts/context.mjs --target app/(app)/profile` failed in bash with `syntax error near unexpected token '('` because Next.js route-group folders contain parentheses. Worked once quoted.

**Suggested improvement:** In SKILL.md Setup step 1, note that the `--target` value should be quoted (route groups, spaces).

**Principle:** Any skill instructing agents to pass file paths as CLI arguments should require quoting, since framework conventions (Next.js route groups) put shell metacharacters in ordinary paths.

### Observation 2: Plan-vs-design discrepancies should be surfaced as decisions, not silently resolved

**Status:** ACTIONED (2026-07-31) — Added Step 1b (Reconcile Authoritative Sources) to `.agents/skills/architect/SKILL.md`.
**Date:** 2026-07-31
**Session context:** Feature 05 Profile Page — shape phase
**Skill:** New skill candidate: none — candidate rule for project feature workflow (architect/shape step)
**Type:** internal
**Phase/Area:** Pre-build spec reconciliation

**Issue:** `build-plan.md` Feature 05 lists a "Cover Letter Tone" dropdown, but the binding design (`profile.png`) omits it and cover-letter generation is out of product scope. Same pattern as Feature 04's "tailored fields" conflict. Surfaced to the user as a structured question; user chose the design.

**Suggested improvement:** The project's pre-build step (architect/shape) should include an explicit "diff the feature spec against the design asset and product scope; surface conflicts as decisions" checkpoint, and the resolution should be recorded in progress-tracker.md.

**Principle:** When two authoritative project documents conflict, the agent should present the conflict as a user decision with a recommendation instead of silently following either document.

### Observation 3: Living registry docs drift — verify claims against the source of truth

**Status:** ACTIONED (2026-07-31) — Added Step 2b (Verify Capability Claims) to imprint skill; corrected Alert entry in `context/ui-registry.md`.
**Date:** 2026-07-31
**Session context:** Feature 05 Profile Page — building error-colored banner tags
**Skill:** imprint
**Type:** open-source
**Phase/Area:** ui-registry.md maintenance

**Issue:** `ui-registry.md`'s Alert entry claimed "the design system has no error/success color yet", but `--color-error` and success tokens have existed in `app/globals.css` for several features. Trusting the registry would have blocked the design-mandated red attention tags; checking globals.css resolved it. (Registry corrected this session.)

**Suggested improvement:** The imprint skill (and any registry-maintenance step) should instruct that capability claims ("token X doesn't exist yet") be re-verified against the actual token source before being relied on, and stale claims corrected during the same session's registry update.

**Principle:** Living pattern documents record history, not truth — before letting a documented limitation constrain a build, verify it against the code it summarizes.

---

## 2026-08-18

### Observation 4: Skill-router still pointed at the old planning door after OpenSpec adoption

**Status:** ACTIONED (2026-08-18) — `using-superpowers` now routes "Let's build X" to `/opsx-explore` then `/opsx-propose`; brainstorming/writing-plans/executing-plans stay superseded unless the user explicitly asks for Superpowers plans.
**Date:** 2026-08-18
**Session context:** OpenSpec + AI workflow cleanup
**Skill:** using-superpowers
**Type:** internal
**Phase/Area:** Skill Priority / plan-mode gate

**Issue:** Slimming AGENTS.md and superseding Superpowers planning skills is not enough. `using-superpowers` still said "before plan mode, invoke brainstorming" and mapped "Let's build X" to brainstorming first. Description-level matching would have auto-invoked the retired skill.

**Suggested improvement:** When the project's planning owner changes (OpenSpec, or anything else), update the skill-router's plan-mode gate and "Let's build X" mapping in the same change — not only the AGENTS.md list.

**Principle:** A skill inventory rewrite does not change agent behavior if a meta-router skill still names the old default path. Update the router in the same change as the inventory.
