import { Building2 } from "lucide-react";

/**
 * The Company Research card, before research exists.
 *
 * The design draws an active "Research Company" button and copy telling the
 * user to click it, but the endpoint is Feature 13. Until then the card holds
 * an empty state with no control and no instruction to use one — the same rule
 * that kept the job list's rows inert until this page existed: a control that
 * leads nowhere is worse than none. Feature 13 adds the button and replaces
 * the body with the dossier.
 *
 * Deliberately does not read `jobs.company_research`; nothing writes it yet.
 */
export function CompanyResearch({ company }: { company: string | null }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-muted"
          aria-hidden="true"
        >
          <Building2 className="h-4 w-4 text-accent" />
        </span>
        <h2 className="text-base font-semibold text-text-primary">Company Research</h2>
      </div>
      <div className="py-12 text-center">
        <span
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-surface-secondary"
          aria-hidden="true"
        >
          <Building2 className="h-6 w-6 text-text-muted" />
        </span>
        <p className="mt-4 text-sm font-medium text-text-primary">No research yet</p>
        <p className="mt-1 text-sm text-text-muted">
          {/* A missing company is left out of the sentence, never replaced with
              a stand-in name — see `COMPANY_NOT_PROVIDED`. */}
          {company === null
            ? "A research dossier will appear here."
            : `A research dossier on ${company} will appear here.`}
        </p>
      </div>
    </section>
  );
}
