import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CircleAlert } from "lucide-react";
import { z } from "zod";
import { CompanyResearch } from "@/components/job-details/CompanyResearch";
import { JobActions } from "@/components/job-details/JobActions";
import { JobDescription } from "@/components/job-details/JobDescription";
import { JobInfo } from "@/components/job-details/JobInfo";
import { MatchScore } from "@/components/job-details/MatchScore";
import { createInsforgeServer } from "@/lib/insforge-server";
import {
  jobListHref,
  parseJobListParams,
  type RawSearchParams,
} from "@/lib/job-list-params";
import { parseJobRow } from "@/lib/parse-job";
import { safeExternalUrl } from "@/lib/utils";
import type { Job } from "@/types";

const SECONDARY_LINK_CLASS =
  "rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-1 focus:ring-accent";

/**
 * Checked before the database is asked. PostgREST answers a malformed uuid with
 * a 22P02 *error*, which this page would otherwise have to report as a load
 * failure — telling a user with a typo in the URL to "try again".
 */
const jobIdSchema = z.uuid();

type LoadResult = { status: "found"; job: Job } | { status: "missing" } | { status: "failed" };

/**
 * One saved job of the signed-in user's, or why there is none.
 *
 * Filtered by `user_id` as well as `id`, so another user's job comes back as no
 * row — the same `missing` as an id that does not exist, and so the same 404.
 * The `jobs_select_own` RLS policy enforces it a second time. Querying by `id`
 * alone and comparing owners in code would read someone else's row into the
 * server before discarding it.
 */
async function loadJob(id: string): Promise<LoadResult> {
  const insforge = await createInsforgeServer();
  const { data: auth, error: authError } = await insforge.auth.getCurrentUser();
  const userId = auth?.user?.id ?? null;

  if (authError || userId === null) {
    // `proxy.ts` redirects a request with no session, so reaching here without a
    // user means the session read broke — a load failure, as on the list page.
    return { status: "failed" };
  }

  // `.limit(1)` over `.maybeSingle()`: it relies only on calls the list page
  // already exercises against InsForge.
  const { data, error } = await insforge.database
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    console.error("[find-jobs/[id]/page] could not load job", error);
    return { status: "failed" };
  }

  const row: unknown = Array.isArray(data) ? data[0] : undefined;
  if (row === undefined) {
    return { status: "missing" };
  }

  const job = parseJobRow(row);
  if (job === null) {
    console.error("[find-jobs/[id]/page] job row is malformed", { id });
    return { status: "failed" };
  }
  return { status: "found", job };
}

function BackToJobs({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 self-start text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      Back to Jobs
    </Link>
  );
}

/**
 * One saved job, in full.
 *
 * Back to Jobs returns to the list view the user came from: the row link
 * carries the list's `q` / `match` / `sort` / `page`, and they are re-parsed
 * here by the same validator the list uses. `jobListHref` fixes the pathname
 * and writes only those four validated keys, so no query string can make the
 * link lead anywhere but `/find-jobs`.
 */
export default async function JobDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const backHref = jobListHref("/find-jobs", parseJobListParams(rawSearchParams));

  if (!jobIdSchema.safeParse(id).success) {
    notFound();
  }

  const result = await loadJob(id);
  if (result.status === "missing") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-[1440px] px-8 py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <BackToJobs href={backHref} />

        {result.status === "failed" ? (
          <section className="rounded-2xl border border-border bg-surface p-6 py-16 text-center shadow-card">
            <h1 className="sr-only">Job details</h1>
            <CircleAlert className="mx-auto h-6 w-6 text-error" aria-hidden="true" />
            <p className="mt-3 text-sm text-text-muted" role="alert">
              Could not load this job. This is usually temporary.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              {/* A plain anchor: the page has no client code, so a real reload is
                  the retry. */}
              <a
                href={jobListHref(`/find-jobs/${id}`, parseJobListParams(rawSearchParams))}
                className={SECONDARY_LINK_CLASS}
              >
                Try again
              </a>
            </div>
          </section>
        ) : (
          <JobDetails job={result.job} />
        )}

        {result.status === "found" ? (
          <p className="text-xs text-text-muted">Jobs by Adzuna</p>
        ) : null}
      </div>
    </div>
  );
}

function JobDetails({ job }: { job: Job }) {
  // Checked once and handed down, so every link on the page agrees on whether
  // the stored address is safe to open.
  const postingUrl = safeExternalUrl(job.external_apply_url);
  return (
    <>
      <JobInfo job={job} postingUrl={postingUrl} />
      <MatchScore job={job} />
      <JobDescription description={job.about_role} postingUrl={postingUrl} />
      <CompanyResearch company={job.company} />
      <JobActions company={job.company} postingUrl={postingUrl} />
    </>
  );
}
