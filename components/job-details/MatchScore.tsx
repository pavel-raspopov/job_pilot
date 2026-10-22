import { Check, Sparkles, X } from "lucide-react";
import type { Job } from "@/types";

const CARD_CLASS = "rounded-2xl border border-border bg-surface p-6 shadow-card";

const SECTION_HEADING_CLASS = "text-xs font-medium uppercase tracking-wide text-text-secondary";

const MUTED_TEXT_CLASS = "mt-4 text-sm text-text-muted";

const SKILL_PILL_BASE_CLASS =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

/** Token pairs from `context/ui-tokens.md` → Skills Badges. */
const MATCHED_PILL_CLASS = `${SKILL_PILL_BASE_CLASS} bg-success-lightest text-success-foreground`;
const GAP_PILL_CLASS = `${SKILL_PILL_BASE_CLASS} bg-accent-muted text-accent`;

function SkillList({
  heading,
  skills,
  pillClass,
  icon: Icon,
  emptyCopy,
}: {
  heading: string;
  skills: string[];
  pillClass: string;
  icon: typeof Check;
  emptyCopy: string;
}) {
  return (
    <div>
      <h3 className="mt-4 text-xs text-text-muted">{heading}</h3>
      {skills.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">{emptyCopy}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {skills.map((skill, index) => (
            // Index-qualified: a list saved before `filter-match-skills` can
            // repeat a name, and a duplicate key would drop or reuse a pill.
            <li key={`${index}-${skill}`} className={pillClass}>
              {/* Decorative, unlike the profile's removable tag pill: no
                  handler, not focusable. The heading above names the list, so
                  the colour is never the only signal. */}
              <Icon className="h-3 w-3" aria-hidden="true" />
              {skill}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The model's assessment of the job against the profile: its reason, and the
 * skills it named on each side.
 *
 * Shown as one snapshot, captioned as such. The score, the reason and both
 * lists were produced together when the job was scored; re-filtering only the
 * lists against today's profile would let them contradict the reason (a reason
 * praising React beside a "You have" list without it). Decided during
 * `/architect` for Feature 12.
 *
 * An unscored job — a scoring call that failed — has none of the four values,
 * and says so. A later search that finds the job again fills them in, which is
 * why the copy can promise it.
 */
export function MatchScore({ job }: { job: Job }) {
  const unscored = job.match_score === null;

  return (
    <>
      <section className={CARD_CLASS}>
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-success-lightest"
            aria-hidden="true"
          >
            <Sparkles className="h-4 w-4 text-success" />
          </span>
          <h2 className={SECTION_HEADING_CLASS}>AI Match Reasoning</h2>
        </div>
        {unscored ? (
          <p className={MUTED_TEXT_CLASS}>
            This job hasn&apos;t been scored yet. It will be scored the next time a search
            finds it.
          </p>
        ) : job.match_reason === null ? (
          <p className={MUTED_TEXT_CLASS}>No reasoning was recorded for this match.</p>
        ) : (
          <p className="mt-4 text-sm leading-6 text-text-primary">{job.match_reason}</p>
        )}
      </section>

      <section className={CARD_CLASS}>
        <h2 className={SECTION_HEADING_CLASS}>Required Skills vs Your Profile</h2>
        <p className="mt-1 text-xs text-text-muted">
          Based on your profile when this job was found.
        </p>
        {unscored ? (
          <p className={MUTED_TEXT_CLASS}>Skills are compared when the job is scored.</p>
        ) : (
          <>
            <SkillList
              heading="You have"
              skills={job.matched_skills ?? []}
              pillClass={MATCHED_PILL_CLASS}
              icon={Check}
              emptyCopy="None of your profile skills were matched for this job."
            />
            <SkillList
              heading="Gap skills"
              skills={job.missing_skills ?? []}
              pillClass={GAP_PILL_CLASS}
              icon={X}
              emptyCopy="No gaps were found."
            />
          </>
        )}
      </section>
    </>
  );
}
