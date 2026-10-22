import { FileText } from "lucide-react";

const CARD_CLASS = "rounded-2xl border border-border bg-surface p-6 shadow-card";

/**
 * The description the provider supplied.
 *
 * For an Adzuna job this is `about_role`, which holds Adzuna's snippet of the
 * posting — often cut off mid-sentence — not the full text. The note says so,
 * and points at the full posting when there is a safe link to it.
 */
export function JobDescription({
  description,
  postingUrl,
}: {
  description: string | null;
  postingUrl: string | null;
}) {
  return (
    <section className={CARD_CLASS}>
      <div className="flex items-center gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-secondary"
          aria-hidden="true"
        >
          <FileText className="h-4 w-4 text-text-muted" />
        </span>
        <h2 className="text-base font-semibold text-text-primary">Job Description</h2>
      </div>

      {description === null ? (
        <p className="mt-4 text-sm text-text-muted">No description was provided for this job.</p>
      ) : (
        <>
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-text-primary">
            {description}
          </p>
          <p className="mt-4 text-xs text-text-muted">
            This is a preview from the job provider.
            {postingUrl !== null ? (
              <>
                {" "}
                <a
                  href={postingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  Read the full posting
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </>
            ) : null}
          </p>
        </>
      )}
    </section>
  );
}
