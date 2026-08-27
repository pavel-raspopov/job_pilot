# Skill Observation Log

Observations captured during task-oriented work.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = skill
updated/created | DECLINED (YYYY-MM-DD) = user decided not to pursue —
resolved statuses always carry their resolution date

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

### Observation 5: YAML list items with colons silently drop a whole config file

**Status:** ACTIONED (2026-08-27) — all 8 colon-bearing list items under `rules:` / `operations:` in `openspec/config.yaml` are now double-quoted (L46, 54, 56, 57, 61, 67, 69, 74). Verified by parsing the file with the same `yaml` library whose error the CLI was surfacing: every rule item is now a plain string, not a nested mapping. Items inside the `context: |` block scalar were correctly left alone.
**Date:** 2026-08-18
**Session context:** `/opsx-propose` Feature 06 — `openspec` CLI ignored `openspec/config.yaml`
**Skill:** openspec-propose
**Type:** open-source
**Phase/Area:** Config loading / schema rules

**Issue:** Every `openspec` command printed `could not parse openspec/config.yaml (Nested mappings are not allowed in compact mappings at line 61, column 23); ignoring it.` Line 61 is a list item containing unquoted colons (`After UI tasks: /imprint. After all tasks: ...`). The CLI still scaffolded the change using defaults, so proposal/design/tasks rules in that file never bound through the tool.

**Suggested improvement:** Quote YAML list items that contain colons, or avoid `key: value` inside a `-` item. Skills that emit YAML config should mention this. After a parse warning, treat the file as unloaded and fix it before relying on its rules.

**Principle:** An unquoted colon in a YAML list value is parsed as a nested mapping; the loader may ignore the entire file and continue with defaults, so constraints vanish without a hard failure.
