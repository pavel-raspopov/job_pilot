/**
 * Shared utility functions.
 *
 * Named in `context/architecture.md`'s tree; first used by Feature 09.
 */

/**
 * The boundary between a High Match and a Low Match.
 *
 * Exported so the Find Jobs match filter and the match-score colour bands read
 * the same number. They describe the same boundary — a job shown in the success
 * colour is exactly a job the High Match filter keeps — and two literals would
 * be free to drift apart. `context/build-plan.md` Feature 11 defines High Match
 * as `match_score >= 70`; `context/ui-tokens.md` puts green at 70–100.
 */
export const HIGH_MATCH_THRESHOLD = 70;

/**
 * What a job with no company name shows where the company stands on its own —
 * the list's company cell and the details page's header.
 *
 * One rule for every place a company is named: where it stands alone, say it
 * was not provided; where it sits inside a sentence ("{role} at {company}",
 * "Apply Now at {company}", "a dossier on {company}"), leave it out rather than
 * invent a stand-in name. Before this, one missing company read three
 * different ways across the list and the details page.
 */
export const COMPANY_NOT_PROVIDED = "Company not provided";

/** Lower bound of the warning band. Below it, a score reads as muted. */
const MID_MATCH_THRESHOLD = 50;

export type ScoreBand = "high" | "mid" | "low";

/**
 * Which colour band a match score falls in.
 *
 * One rule for every place a score is drawn — the list's bar and the details
 * page's pill — so the two cannot disagree about where green starts. Each
 * caller maps the band to its own classes, because a bar fill and a pill need
 * different utilities for the same band.
 */
export function scoreBand(score: number): ScoreBand {
  if (score >= HIGH_MATCH_THRESHOLD) return "high";
  if (score >= MID_MATCH_THRESHOLD) return "mid";
  return "low";
}

/**
 * The address to link to, or `null` when it is not safe to put in an `href`.
 *
 * Only `http:` and `https:` pass. React renders a `javascript:` href as given
 * (it only warns in development), and these addresses come from a third-party
 * API, so this check is the guard rather than a nicety. `new URL` also strips
 * the leading whitespace and embedded tabs that would otherwise disguise a
 * scheme, so the protocol is read from what a browser would actually run.
 */
export function safeExternalUrl(value: string | null): string | null {
  if (value === null || value.trim() === "") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Format an ISO timestamp as a relative label ("2 hours ago", "Yesterday").
 *
 * Granularity is deliberately no finer than an hour. This runs during both the
 * server render and hydration, milliseconds apart; a seconds-level bucket could
 * land on either side of a boundary in that gap and produce a hydration
 * mismatch. Hour and day buckets cannot realistically flip in that window.
 *
 * Dates beyond a month fall back to an absolute date pinned to `en-US`/UTC —
 * the server's locale and time zone are not the viewer's, and an unpinned
 * format would differ between the two renders.
 */
export function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const elapsed = Date.now() - then;
  if (elapsed < HOUR_MS) return "Just now";

  const hours = Math.floor(elapsed / HOUR_MS);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;

  const days = Math.floor(elapsed / DAY_MS);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;

  return new Date(then).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
