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
