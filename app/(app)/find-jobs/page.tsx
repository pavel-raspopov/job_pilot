import { JobsTable } from "@/components/find-jobs/JobsTable";
import { SearchControls } from "@/components/find-jobs/SearchControls";
import { createInsforgeServer } from "@/lib/insforge-server";
import { parseJobRow } from "@/lib/parse-job";
import type { Job } from "@/types";

/**
 * The signed-in user's saved jobs.
 *
 * Ordered newest first, which matches the covering index on
 * `(user_id, found_at desc)` — and because `Array.prototype.sort` is stable, it
 * also becomes the tiebreak inside `JobsTable`'s default score sort, so equal
 * scores come out newest-first.
 *
 * No `.limit()`: a cap would silently truncate while the pagination footer went
 * on reporting "of N results" from the truncated array. Feature 11 moves the
 * querying server-side and owns real paging; that is the point to revisit this.
 *
 * A query failure is passed down as `loadFailed` rather than falling through as
 * an empty list — an empty list would tell a user with forty saved jobs to run
 * their first search.
 */
export default async function FindJobsPage() {
  const insforge = await createInsforgeServer();
  const { data } = await insforge.auth.getCurrentUser();
  const user = data?.user;

  let jobs: Job[] = [];
  let loadFailed = false;

  if (user?.id) {
    const { data: rows, error } = await insforge.database
      .from("jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("found_at", { ascending: false });

    if (error) {
      console.error("[find-jobs/page] could not load jobs", error);
      loadFailed = true;
    } else if (Array.isArray(rows)) {
      jobs = rows
        .map((row: unknown) => parseJobRow(row))
        .filter((job): job is Job => job !== null);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-8 py-8">
      <h1 className="sr-only">Find Jobs</h1>
      <div className="flex flex-col gap-6">
        <SearchControls />
        <JobsTable jobs={jobs} loadFailed={loadFailed} />
      </div>
    </div>
  );
}
