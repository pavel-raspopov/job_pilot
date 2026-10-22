import type { ReactNode } from "react";
import {
  Briefcase,
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import {
  COMPANY_NOT_PROVIDED,
  formatRelativeDate,
  scoreBand,
  type ScoreBand,
} from "@/lib/utils";
import type { Job } from "@/types";

const CARD_CLASS = "rounded-2xl border border-border bg-surface p-6 shadow-card";

/**
 * Fact cards carry `p-4`, the third documented Card padding override (see
 * `context/ui-registry.md`): two lines of text beside an icon tile, and `p-6`
 * makes the row noticeably taller than the design.
 */
const FACT_CARD_CLASS =
  "flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card";

const PILL_BASE_CLASS =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium";

/**
 * A complete class string per state, chosen rather than appended (the Variant
 * Class Standard). Only the high band gets the coloured wash the design draws.
 * Mid and low stay neutral and carry the band in the dot instead, because
 * `text-warning` on white is roughly 2.4:1 — below AA for 12px text — and no
 * darker warning token exists. The dot shows the band; the text shows the value.
 */
const PILL_CLASS: Record<ScoreBand | "unscored", string> = {
  high: `${PILL_BASE_CLASS} bg-success-lightest text-success-foreground`,
  mid: `${PILL_BASE_CLASS} bg-surface-secondary text-text-dark`,
  low: `${PILL_BASE_CLASS} bg-surface-secondary text-text-dark`,
  unscored: `${PILL_BASE_CLASS} bg-surface-secondary text-text-dark`,
};

/** The same fills as the list's score bar, so a band reads the same everywhere. */
const DOT_CLASS: Record<ScoreBand, string> = {
  high: "bg-success",
  mid: "bg-warning",
  low: "bg-text-muted",
};

const SECONDARY_LINK_CLASS =
  "inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-1 focus:ring-accent";

function MatchScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className={PILL_CLASS.unscored}>Not scored</span>;
  }
  const band = scoreBand(score);
  return (
    <span className={PILL_CLASS[band]}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[band]}`} aria-hidden="true" />
      {score}% Match Score
    </span>
  );
}

/** The design's em dash, with words for assistive technology. */
function NotProvided() {
  return (
    <>
      <span aria-hidden="true">&mdash;</span>
      <span className="sr-only">Not provided</span>
    </>
  );
}

function FactCard({
  icon: Icon,
  tileClass,
  label,
  title,
  children,
}: {
  icon: LucideIcon;
  tileClass: string;
  label: string;
  /** The full value for the hover tooltip; `truncate` only clips it visually. */
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={FACT_CARD_CLASS}>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${tileClass}`}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text-primary" title={title}>
          {children}
        </p>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      </div>
    </div>
  );
}

/**
 * The job's header and its four key facts.
 *
 * `postingUrl` arrives already checked by `safeExternalUrl` — null when the
 * stored address is absent or not `http(s)`, in which case there is no View Job
 * Post link at all rather than a link that goes nowhere.
 */
export function JobInfo({ job, postingUrl }: { job: Job; postingUrl: string | null }) {
  return (
    <>
      <section className={`${CARD_CLASS} flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6`}>
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-surface-secondary"
            aria-hidden="true"
          >
            <Building2 className="h-6 w-6 text-text-muted" />
          </span>
          <div className="min-w-0">
            {/* `break-words`: a title or company with no spaces would otherwise
                run past the card's edge — measured 805px of text in a 597px box. */}
            <h1 className="break-words text-2xl font-semibold text-text-primary">
              {job.title ?? "Untitled role"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <span className="min-w-0 break-words">{job.company ?? COMPANY_NOT_PROVIDED}</span>
              <span aria-hidden="true">&bull;</span>
              <MatchScoreBadge score={job.match_score} />
            </div>
          </div>
        </div>
        {postingUrl !== null ? (
          <a
            href={postingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${SECONDARY_LINK_CLASS} self-start`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            View Job Post
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <FactCard
          icon={DollarSign}
          tileClass="bg-success-lightest text-success"
          label="Salary Est."
          title={job.salary ?? undefined}
        >
          {job.salary ?? <NotProvided />}
        </FactCard>
        <FactCard
          icon={MapPin}
          tileClass="bg-info-lightest text-info-foreground"
          label="Location"
          title={job.location ?? undefined}
        >
          {job.location ?? <NotProvided />}
        </FactCard>
        <FactCard
          icon={Briefcase}
          tileClass="bg-accent-muted text-accent"
          label="Job Type"
          title={job.job_type ?? undefined}
        >
          {job.job_type ?? <NotProvided />}
        </FactCard>
        <FactCard
          icon={Calendar}
          tileClass="bg-surface-secondary text-text-muted"
          label="Date Found"
        >
          <time dateTime={job.found_at}>{formatRelativeDate(job.found_at)}</time>
        </FactCard>
      </div>
    </>
  );
}
