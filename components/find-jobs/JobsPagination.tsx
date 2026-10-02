type Props = {
  page: number;
  totalPages: number;
  totalResults: number;
  /** 1-based index of the first visible row. */
  rangeStart: number;
  /** 1-based index of the last visible row. */
  rangeEnd: number;
  onPageChange: (page: number) => void;
  /**
   * A page change is in flight. Every control goes inert, so a second click
   * cannot skip past the page the first one asked for.
   */
  disabled?: boolean;
};

const BUTTON_BASE_CLASS =
  "rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed";

// The colours are chosen per state rather than overridden. Appending
// `bg-accent-muted text-accent` to a class that already holds `bg-surface
// text-text-primary` does nothing visible: both utilities match, and the one
// later in the generated stylesheet wins — which was `bg-surface`, so the
// current page looked like every other page.
const BUTTON_CLASS = `${BUTTON_BASE_CLASS} bg-surface text-text-primary hover:bg-surface-secondary`;
const CURRENT_BUTTON_CLASS = `${BUTTON_BASE_CLASS} bg-accent-muted text-accent`;

type PageSlot = { kind: "page"; page: number } | { kind: "gap"; key: string };

/** How many page numbers the window around the current page holds. */
const WINDOW_SIZE = 3;

/**
 * The page numbers to offer, with a gap wherever a run of pages is elided.
 *
 * Always the first page, the last page, and a three-page window containing the
 * current page and its neighbours. At an edge the window slides inward rather
 * than shrinking, so page 1 of 8 is `1 2 3 … 8` — which is what
 * `context/designs/find-jobs.png` draws. A gap standing for exactly one page
 * shows that page instead: "…" in place of a single number hides something
 * without saving any room.
 */
function pageWindow(page: number, totalPages: number): PageSlot[] {
  const start = Math.max(1, Math.min(page - 1, totalPages - WINDOW_SIZE + 1));
  const end = Math.min(totalPages, start + WINDOW_SIZE - 1);

  const pages = new Set<number>([1, totalPages]);
  for (let n = start; n <= end; n++) pages.add(n);

  const slots: PageSlot[] = [];
  let previous = 0;
  for (const n of [...pages].sort((a, b) => a - b)) {
    if (n - previous === 2) {
      slots.push({ kind: "page", page: n - 1 });
    } else if (n - previous > 2) {
      slots.push({ kind: "gap", key: `gap-${previous}-${n}` });
    }
    slots.push({ kind: "page", page: n });
    previous = n;
  }
  return slots;
}

/**
 * Job list footer.
 *
 * Presentational only. The page count is derived by the caller from the
 * filtered total, never fixed: the design's footer pairs "of 24 results" with
 * eight page buttons, which cannot both be right.
 *
 * Long page runs are elided (see `pageWindow`). An earlier version gave every
 * page its own button, on the grounds that the count never exceeded four; that
 * held for a capped mock, not for a list that is every search the user has run.
 */
export function JobsPagination({
  page,
  totalPages,
  totalResults,
  rangeStart,
  rangeEnd,
  onPageChange,
  disabled = false,
}: Props) {
  return (
    <div className="flex flex-col gap-4 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-text-secondary">
        Showing <span className="font-medium text-text-primary">{rangeStart}</span>{" "}
        to <span className="font-medium text-text-primary">{rangeEnd}</span> of{" "}
        <span className="font-medium text-text-primary">{totalResults}</span>{" "}
        results
      </p>

      <nav aria-label="Job list pages">
        <ul className="flex flex-wrap items-center gap-2">
          <li>
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={disabled || page === 1}
              className={BUTTON_CLASS}
            >
              Previous
            </button>
          </li>

          {pageWindow(page, totalPages).map((slot) => {
            if (slot.kind === "gap") {
              return (
                <li key={slot.key} className="px-2 text-sm text-text-muted">
                  <span aria-hidden="true">&hellip;</span>
                  <span className="sr-only">More pages</span>
                </li>
              );
            }

            const isCurrent = slot.page === page;
            return (
              <li key={slot.page}>
                <button
                  type="button"
                  onClick={() => onPageChange(slot.page)}
                  disabled={disabled}
                  aria-current={isCurrent ? "page" : undefined}
                  aria-label={`Page ${slot.page}`}
                  className={isCurrent ? CURRENT_BUTTON_CLASS : BUTTON_CLASS}
                >
                  {slot.page}
                </button>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={disabled || page === totalPages}
              className={BUTTON_CLASS}
            >
              Next
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
