import type { Job, JobSource } from "@/types";

/**
 * Turns one untrusted `jobs` row into a `Job`, or null when it is unusable.
 *
 * `insforge.database.from()` types its `data` as `any[]`, so assigning it
 * straight to `Job[]` compiles with no checking at all — the `any` leak
 * `context/code-standards.md` forbids — and `as Job[]` is the assertion it also
 * forbids. This is the same job `lib/parse-profile.ts` does for `profiles`, and
 * deliberately mirrors its shape.
 *
 * The helpers below are duplicated from that file rather than shared: they are
 * six lines each, and keeping the two parsers independent means neither can
 * break the other when a column changes.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Null, not [], so an absent column stays distinguishable from an empty one. */
function asNullableStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter((item): item is string => typeof item === "string");
}

function isJobSource(value: unknown): value is JobSource {
  return value === "search" || value === "url";
}

export function parseJobRow(value: unknown): Job | null {
  if (!isRecord(value)) {
    return null;
  }

  // The four NOT NULL columns. A row missing any of them cannot be rendered,
  // and `source` additionally carries a CHECK constraint this mirrors.
  const id = asNullableString(value.id);
  const userId = asNullableString(value.user_id);
  const foundAt = asNullableString(value.found_at);

  if (id === null || userId === null || foundAt === null || !isJobSource(value.source)) {
    return null;
  }

  return {
    id,
    run_id: asNullableString(value.run_id),
    user_id: userId,
    source: value.source,
    source_url: asNullableString(value.source_url),
    external_apply_url: asNullableString(value.external_apply_url),
    title: asNullableString(value.title),
    company: asNullableString(value.company),
    location: asNullableString(value.location),
    salary: asNullableString(value.salary),
    job_type: asNullableString(value.job_type),
    about_role: asNullableString(value.about_role),
    responsibilities: asNullableStringArray(value.responsibilities),
    requirements: asNullableStringArray(value.requirements),
    nice_to_have: asNullableStringArray(value.nice_to_have),
    benefits: asNullableStringArray(value.benefits),
    about_company: asNullableString(value.about_company),
    // Never coerced to 0: the list renders an absent score as an em dash, and a
    // zero would read as "scored, and scored terribly".
    match_score: typeof value.match_score === "number" ? value.match_score : null,
    match_reason: asNullableString(value.match_reason),
    matched_skills: asNullableStringArray(value.matched_skills),
    missing_skills: asNullableStringArray(value.missing_skills),
    company_research: isRecord(value.company_research) ? value.company_research : null,
    found_at: foundAt,
  };
}
