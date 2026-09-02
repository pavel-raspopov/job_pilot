type Props = {
  page: number;
  totalPages: number;
  totalResults: number;
  /** 1-based index of the first visible row. */
  rangeStart: number;
  /** 1-based index of the last visible row. */
  rangeEnd: number;
  onPageChange: (page: number) => void;
};

const BUTTON_CLASS =
  "rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed";

/**
 * Job list footer.
 *
 * Presentational only. The page count is derived by the caller from the
 * filtered total, never fixed: the design's footer pairs "of 24 results" with
 * eight page buttons, which cannot both be right.
 *
 * Every page gets its own button. The design shows an ellipsis because its mock
 * claimed eight pages; the real count here never exceeds four, so truncation
 * would be code no one can exercise. Feature 11 adds it if a larger page count
 * ever needs it.
 */
export function JobsPagination({
  page,
  totalPages,
  totalResults,
  rangeStart,
  rangeEnd,
  onPageChange,
}: Props) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

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
              disabled={page === 1}
              className={BUTTON_CLASS}
            >
              Previous
            </button>
          </li>

          {pages.map((pageNumber) => {
            const isCurrent = pageNumber === page;
            return (
              <li key={pageNumber}>
                <button
                  type="button"
                  onClick={() => onPageChange(pageNumber)}
                  aria-current={isCurrent ? "page" : undefined}
                  aria-label={`Page ${pageNumber}`}
                  className={`${BUTTON_CLASS} ${
                    isCurrent ? "bg-accent-muted text-accent" : ""
                  }`}
                >
                  {pageNumber}
                </button>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
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
