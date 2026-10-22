import Link from "next/link";
import { SearchX } from "lucide-react";

/**
 * Shown for a malformed id, an id that names no job, and another user's job
 * alike. The three are deliberately indistinguishable — the copy never says
 * "not yours", which would confirm that the job exists.
 *
 * Back to Jobs goes to the plain list: `not-found` receives no `searchParams`,
 * so the view the user came from is not available here.
 */
export default function JobNotFound() {
  return (
    <div className="mx-auto max-w-[1440px] px-8 py-8">
      <div className="mx-auto max-w-4xl">
        <section className="rounded-2xl border border-border bg-surface p-6 py-16 text-center shadow-card">
          <SearchX className="mx-auto h-6 w-6 text-text-muted" aria-hidden="true" />
          <h1 className="mt-3 text-base font-semibold text-text-primary">Job not found</h1>
          <p className="mt-1 text-sm text-text-muted">
            It may have been removed, or the link may be wrong.
          </p>
          <Link
            href="/find-jobs"
            className="mt-4 inline-block rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-1 focus:ring-accent"
          >
            Back to Jobs
          </Link>
        </section>
      </div>
    </div>
  );
}
