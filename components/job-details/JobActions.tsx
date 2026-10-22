import { ExternalLink } from "lucide-react";

/**
 * Apply Now — the page's one primary action.
 *
 * `postingUrl` is already checked by `safeExternalUrl`. When it is null — no
 * stored address, or one that is not `http(s)` — the page says so instead of
 * rendering a link that would go nowhere or run script.
 */
export function JobActions({
  company,
  postingUrl,
}: {
  company: string | null;
  postingUrl: string | null;
}) {
  if (postingUrl === null) {
    return (
      <p className="text-center text-sm text-text-muted">
        No application link was provided for this job.
      </p>
    );
  }

  return (
    <a
      href={postingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-accent"
    >
      {company === null ? "Apply Now" : `Apply Now at ${company}`}
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
