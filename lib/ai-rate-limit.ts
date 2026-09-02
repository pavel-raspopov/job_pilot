import type { createInsforgeServer } from "@/lib/insforge-server";

type InsforgeServerClient = Awaited<ReturnType<typeof createInsforgeServer>>;

/**
 * Per-user rate limiting for routes that call the InsForge AI gateway.
 *
 * Every gateway call is billed, and the client-side in-flight ref guards stop an
 * accidental double click but nothing else: an authenticated user can still loop
 * `POST /api/resume/generate` directly and spend the plan's credit. The limit
 * therefore has to be enforced where the money is spent.
 *
 * State lives in the `ai_usage` table (`db/migrations/004_add_ai_usage.sql`) and
 * not in process memory, because serverless instances share no memory — an
 * in-memory counter is per-instance, which is not a limit.
 *
 * **Every new AI route must call this.** Add a key to `AI_ROUTE`, a limit to
 * `LIMITS`, and both calls to the route: `checkAiRateLimit` before the first
 * model call, `recordAiCall` immediately before it.
 */

/** Route keys stored in `ai_usage.route`. Free text in the DB, closed here. */
export const AI_ROUTE = {
  resumeExtract: "resume_extract",
  resumeGenerate: "resume_generate",
  agentFind: "agent_find",
} as const;

export type AiRoute = (typeof AI_ROUTE)[keyof typeof AI_ROUTE];

type Limit = {
  /** Rolling window, in seconds. */
  windowSeconds: number;
  /** Calls allowed inside the window. */
  max: number;
};

/**
 * Sized to be invisible to real use and cheap in the worst case.
 *
 * A user extracts from their resume once or twice and generates a handful of
 * times while tuning their profile; ten an hour is far more than that. The
 * ceiling it puts on abuse is what matters: extraction is the dearer of the two
 * because it makes *two* gateway calls (readability probe plus extraction), so
 * ten of each per hour caps a single account at roughly $0.026 an hour against
 * the free plan's $1 a month.
 */
const LIMITS: Record<AiRoute, Limit> = {
  resume_extract: { windowSeconds: 3600, max: 10 },
  resume_generate: { windowSeconds: 3600, max: 10 },
  /**
   * Counts SEARCHES, not listings: one search scores all ten of its results in a
   * single batched gateway call, so ten an hour is ten billed calls, the same
   * ceiling as the two routes above.
   *
   * It also caps the Adzuna free-tier quota, which is shared across every user
   * of this app rather than per-account — which is why the check runs before the
   * provider request, not just before the model call.
   */
  agent_find: { windowSeconds: 3600, max: 10 },
};

export type AiRateLimitVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether this user may make another billed call to this route right now.
 *
 * One round trip: PostgREST returns the exact count alongside the rows, so the
 * `limit(1)` on an ascending order gives both "how many in the window" and "the
 * oldest one in it" — and the oldest is what determines when a slot frees up.
 *
 * **Fails open.** If the count query itself fails, the call is allowed and the
 * error is logged. A cost guard that takes the feature down whenever its own
 * bookkeeping hiccups is worse than one that occasionally lets a call through,
 * and the failure is loud enough to notice.
 */
export async function checkAiRateLimit(
  insforge: InsforgeServerClient,
  userId: string,
  route: AiRoute,
): Promise<AiRateLimitVerdict> {
  const limit = LIMITS[route];
  const windowStartMs = Date.now() - limit.windowSeconds * 1000;

  const { data, error, count } = await insforge.database
    .from("ai_usage")
    .select("created_at", { count: "exact" })
    .eq("user_id", userId)
    .eq("route", route)
    .gte("created_at", new Date(windowStartMs).toISOString())
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("[ai-rate-limit] count failed, allowing the call", error);
    return { allowed: true };
  }

  if ((count ?? 0) < limit.max) {
    return { allowed: true };
  }

  const rows: unknown = data;
  const oldest = Array.isArray(rows) ? rows[0] : undefined;
  const oldestMs =
    isRecord(oldest) && typeof oldest.created_at === "string"
      ? Date.parse(oldest.created_at)
      : Number.NaN;

  // The window is rolling, so the next slot opens one window after the oldest
  // call in it. Falling back to the window edge keeps the number sane if the
  // timestamp is missing or unparseable.
  const freesUpAtMs =
    (Number.isNaN(oldestMs) ? windowStartMs : oldestMs) +
    limit.windowSeconds * 1000;

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((freesUpAtMs - Date.now()) / 1000)),
  };
}

/**
 * Records one billed call.
 *
 * Call it immediately before the model call, not after: the cost is incurred
 * whether or not the result turns out to be usable, so attempts are what the
 * limit has to count. A failure to record is logged and swallowed — losing a
 * tally entry must not fail a request the user has already paid for.
 */
export async function recordAiCall(
  insforge: InsforgeServerClient,
  userId: string,
  route: AiRoute,
): Promise<void> {
  const { error } = await insforge.database
    .from("ai_usage")
    .insert([{ user_id: userId, route }]);

  if (error) {
    console.error("[ai-rate-limit] could not record the call", error);
  }
}

/** "in about 12 minutes" — user-facing, so no bare second counts. */
export function retryAfterPhrase(seconds: number): string {
  if (seconds < 60) {
    return "in less than a minute";
  }
  const minutes = Math.ceil(seconds / 60);
  return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
}
