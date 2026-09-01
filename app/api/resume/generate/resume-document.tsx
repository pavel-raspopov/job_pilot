import path from "node:path";
import {
  Document,
  Font,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Education, Profile, WorkExperienceRole } from "@/types";

/**
 * The generated resume's layout.
 *
 * Server-only by construction: `@react-pdf/renderer` must never reach a client
 * bundle, so this file is colocated with the route that renders it rather than
 * living under `components/` (see `context/library-docs.md`).
 *
 * Facts come from `profile` and are rendered verbatim. The model's output
 * reaches this component only through `prose` — a summary string and bullets
 * per role index — so there is no field the model can misspell into the
 * document. Anything `prose` omits falls back to the stored profile text.
 */

/**
 * Token values copied from `app/globals.css` `@theme` so the PDF matches the
 * app's palette. Raw hex is unavoidable here — a PDF has no CSS variables and
 * `@react-pdf/renderer` takes literal color values. This is the one place in
 * the codebase where a hex literal is correct.
 */
const COLOR = {
  textPrimary: "#101828",
  textSecondary: "#6a7282",
  textMuted: "#99a1af",
  textDark: "#364153",
  accent: "#7c5cfc",
  border: "#e7eaf3",
} as const;

/**
 * Inter, the same family the app uses via `next/font` — and, more importantly,
 * a font that can actually draw the document.
 *
 * The built-in Helvetica is WinAnsi-only, which fails in ways that are easy to
 * miss because nothing errors. Measured on a real render:
 *
 *   "Павел Распопов"      -> "025;" and " 0A?>?>2"  (mangled, not blank)
 *   "•"                    -> dropped entirely (every bullet marker invisible)
 *   "—"                    -> dropped ("Jan 2021  Present")
 *   "José Ferreira-Lühr"  -> fine (Latin-1 is covered)
 *
 * Inter covers all of them (verified against the files' cmap: Latin, Latin-1
 * accents, Cyrillic, bullet, em dash, middot).
 *
 * `FONT_FAMILY` is referenced instead of the literal string everywhere below so
 * the built-in fallback cannot creep back in via a typo.
 */
const FONT_FAMILY = "Inter";
const FONT_DIR = path.join(
  process.cwd(),
  "app",
  "api",
  "resume",
  "generate",
  "fonts",
);

// Read from disk rather than inlined as a base64 data URL — 635KB of base64 in
// source would bloat every build. next.config.ts's `outputFileTracingIncludes`
// keeps these two files in the serverless bundle; without it this works in dev
// and 404s in production.
Font.register({
  family: FONT_FAMILY,
  fonts: [
    { src: path.join(FONT_DIR, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Inter-SemiBold.ttf"), fontWeight: 600 },
  ],
});

// Inter has no hyphenation dictionary here; the default callback breaks long
// words mid-glyph. Returning the word whole is the documented opt-out.
Font.registerHyphenationCallback((word) => [word]);

/**
 * The stylesheet at a given typographic density.
 *
 * `density` scales every point measurement — type sizes, page padding, section
 * and bullet spacing — while leaving unitless line heights and hairline borders
 * alone. 1 is the designed layout.
 *
 * It exists because the resume has to fit one page and trimming bullets is not
 * always enough to get it there: three roles of two-line bullets alongside a
 * 43-skill profile overflows even at three bullets per role. Tightening the
 * type is what a typesetter does in that situation, and it is strictly better
 * than deleting a candidate's achievements to make room.
 */
function buildStyles(density: number) {
  /** Scales a point measurement, keeping two decimals. */
  const pt = (value: number): number =>
    Math.round(value * density * 100) / 100;

  return StyleSheet.create({
    page: {
      paddingVertical: pt(40),
      paddingHorizontal: pt(48),
      fontFamily: FONT_FAMILY,
      fontSize: pt(9.5),
      lineHeight: 1.5,
      color: COLOR.textDark,
    },

    name: {
      fontSize: pt(22),
      fontFamily: FONT_FAMILY,
      fontWeight: 600,
      color: COLOR.textPrimary,
      // Explicit, and not inherited. The page's lineHeight: 1.5 did not give
      // this 22pt line a tall enough box: the name's baseline landed 6pt above
      // the title's and the two overlapped on the rendered page.
      lineHeight: 1.25,
    },
    title: {
      fontSize: pt(11),
      color: COLOR.accent,
      marginTop: pt(4),
    },
    contact: {
      fontSize: pt(9),
      color: COLOR.textSecondary,
      marginTop: pt(6),
    },
    headerRule: {
      marginTop: pt(14),
      marginBottom: pt(18),
      borderBottomWidth: 1,
      borderBottomColor: COLOR.border,
    },

    section: { marginBottom: pt(16) },
    sectionHeading: {
      fontSize: pt(9),
      fontFamily: FONT_FAMILY,
      fontWeight: 600,
      color: COLOR.textPrimary,
      textTransform: "uppercase",
      // No letterSpacing, deliberately. It looked better but each glyph became
      // its own positioned run, so text extraction returned "S U M M A RY" and
      // "E D U CAT I O N". Applicant tracking systems find sections by matching
      // headings like "EXPERIENCE"; a resume that reads well to a human and
      // parses as noise to a machine has failed at its actual job. Uppercase,
      // semibold, and the size step carry the hierarchy on their own.
      marginBottom: pt(7),
    },

    role: { marginBottom: pt(11) },
    roleHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    roleTitle: {
      fontSize: pt(10.5),
      fontFamily: FONT_FAMILY,
      fontWeight: 600,
      color: COLOR.textPrimary,
    },
    roleCompany: {
      fontSize: pt(9.5),
      color: COLOR.textSecondary,
    },
    roleDates: {
      fontSize: pt(8.5),
      color: COLOR.textSecondary,
    },

    bulletRow: {
      flexDirection: "row",
      marginTop: pt(3),
    },
    bulletMark: {
      width: pt(10),
      color: COLOR.accent,
    },
    bulletText: { flex: 1 },

    // Skills render as discrete items in a wrapping row rather than one long
    // joined string. The joined form was being wrap-hyphenated despite
    // registerHyphenationCallback, leaving "jQuery-" and "MongoDB ·-" at line
    // ends. Discrete items cannot break mid-token, so the artifact cannot occur.
    skillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    // No separator element. An interleaved "·" Text doubles the flex-item count
    // and adds its own margin on both sides: with the fixture's 43 skills that
    // pushed the whole section onto a second page. Spacing alone separates them.
    skill: {
      fontSize: pt(9),
      marginRight: pt(8),
      marginBottom: pt(2),
      color: COLOR.textDark,
    },

    educationLine: { marginBottom: pt(3) },
    educationDegree: {
      fontSize: pt(10),
      fontFamily: FONT_FAMILY,
      fontWeight: 600,
      color: COLOR.textPrimary,
    },
  });
}

type Styles = ReturnType<typeof buildStyles>;

/**
 * Built stylesheets, keyed by density. `StyleSheet.create` is not free and the
 * fit loop renders the same few densities repeatedly, sometimes within one
 * request.
 */
const STYLE_CACHE = new Map<number, Styles>();

function stylesFor(density: number): Styles {
  const cached = STYLE_CACHE.get(density);
  if (cached !== undefined) {
    return cached;
  }
  const built = buildStyles(density);
  STYLE_CACHE.set(density, built);
  return built;
}

/** Rewritten prose from the model. Every part is optional — see decision 3. */
export type ResumeProse = {
  summary?: string;
  /** Bullets keyed by index into `profile.work_experience`. */
  bulletsByRole?: Record<number, string[]>;
};

const DEGREE_LABEL: Record<NonNullable<Education["degree"]>, string> = {
  high_school: "High School",
  associate: "Associate",
  bachelors: "Bachelor's",
  masters: "Master's",
  phd: "PhD",
};

function has(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The roles that actually reach the document, in document order.
 *
 * A role with neither a company nor a job title has nothing to head a section
 * with, so it is dropped — but `stripBlankRoles` (lib/profile-completion.ts)
 * persists a role as soon as ANY one of its fields is filled, so such rows do
 * reach here.
 *
 * Exported because the route builds the model's input from the same list. It
 * used to map over the unfiltered `work_experience` while this file rendered
 * the filtered one, so a single dropped role shifted every later role's
 * `role_index` by one: the rewritten bullets of one job were printed under the
 * next job's employer, and that job's own bullets were silently discarded. Two
 * derivations of "which roles count" is one derivation waiting to disagree;
 * there is now only this one.
 */
export function renderableRoles(profile: Profile): WorkExperienceRole[] {
  return (profile.work_experience ?? []).filter(
    (role) => has(role.company) || has(role.job_title),
  );
}

/** "Jan 2021 — Present". Falls back to the raw string if it is not YYYY-MM. */
function formatMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (match === null) {
    return value.trim();
  }
  const monthIndex = Number(match[2]) - 1;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[monthIndex];
  return month === undefined ? value.trim() : `${month} ${match[1]}`;
}

function roleDates(role: WorkExperienceRole): string {
  const start = has(role.start_date) ? formatMonth(role.start_date) : "";
  const end = role.currently_working
    ? "Present"
    : has(role.end_date)
      ? formatMonth(role.end_date)
      : "";

  if (start.length === 0) return end;
  if (end.length === 0) return start;
  return `${start} — ${end}`;
}

function educationLine(education: Education): string {
  const degree =
    education.degree === null ? "" : DEGREE_LABEL[education.degree];
  const parts = [degree, education.field].filter((part) => has(part));
  return parts.join(", ");
}

/**
 * Longest a single bullet may be before it is treated as a paragraph that
 * wants splitting. Comfortably above a real one-line bullet, well below the
 * multi-sentence blobs that need breaking up.
 */
const MAX_BULLET_CHARS = 180;

/**
 * Bullets rendered per role from the model's rewrite.
 *
 * A ceiling, not a target. At 4 it silently dropped the fifth achievement from
 * a role that listed five — the resume was quietly less impressive than the
 * profile it was built from, which is the one thing this feature must not do.
 * Sized to clear a realistic role; the layout absorbs the extra lines.
 *
 * Exported because the route needs the same number for its prompt and tool
 * schema, and two constants that must agree is one constant waiting to drift.
 */
export const MAX_BULLETS_PER_ROLE = 6;

/**
 * Splits a paragraph into sentence-sized bullets.
 *
 * Needed on both input paths, for the same underlying reason — text arrives as
 * one blob when it should be several:
 *
 *  - Stored `responsibilities` is free text. The profile form does not require
 *    newlines, and the real fixture profile holds a 938-character paragraph
 *    with none, so splitting on `\n` alone produced a single wall-of-text
 *    bullet.
 *  - The model sometimes ignores "up to N bullets, each one line" and returns
 *    everything as one string. `maxItems` caps the count but cannot force a
 *    split.
 *
 * The lookbehind only breaks on sentence-ending punctuation followed by a
 * letter that can start a sentence, so "Node.js and Express.js" survives
 * intact while "…stability. Conducts R&D…" splits.
 *
 * The boundary is Unicode-aware on purpose. An ASCII `[A-Z]` would never fire
 * for Cyrillic, Greek, or any non-Latin script — the paragraph would come back
 * as one wall-of-text bullet, which is the bug this function exists to fix,
 * still present for exactly the users the bundled Inter font was added to
 * serve. `\p{Lu}` covers cased scripts; `\p{Lo}` covers uncased ones (CJK,
 * Arabic, Hebrew).
 */
function splitIntoBullets(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0);

  return lines.flatMap((line) =>
    line.length <= MAX_BULLET_CHARS
      ? [line]
      : line
          // Sentence end followed by something that can start one, or a
          // semicolon. The profile form accepts free text and users write
          // achievements both ways — "Migrated X. Owned Y." and
          // "Migrated X; Owned Y" are the same list.
          .split(/(?<=[.!?。！？])\s+(?=\p{Lu}|\p{Lo})|(?<=[;；])\s+/u)
          .map((part) => part.replace(/[;；]$/, "").trim())
          .filter((part) => part.length > 0),
  );
}

/**
 * How much content one render attempt is allowed to emit.
 *
 * The document must fit one page, and no constant can promise that — the same
 * bullet count fits or overflows depending on how long the bullets are, how
 * many roles there are, and how many skills the profile lists.
 * `renderResumePdf` therefore renders, measures, and retries down this ladder.
 */
export type RenderBudget = {
  /** Maximum bullets rendered per role. */
  bulletCap: number;
  /**
   * Typographic density passed to `buildStyles`. 1 is the designed layout;
   * below 1 tightens type and spacing proportionally.
   */
  density: number;
  /**
   * Whether the cap also applies to the stored-responsibilities fallback.
   *
   * False on the first attempt: the cap governs what we ask the *model* to
   * write, and silently dropping the user's own hand-entered text loses
   * information that a long profile is deliberately telling us. It turns on
   * only once an uncapped render has measured at more than one page, where the
   * alternative is not "keep everything" but "emit a two-page one-pager".
   */
  capFallback: boolean;
};

/**
 * Render attempts, in order.
 *
 * The first rung is exactly the behaviour from before measurement existed, so a
 * profile that already fits renders byte-for-byte as it did and pays only for
 * one page count.
 *
 * After that the order encodes a preference: **tighten the type before dropping
 * a bullet.** A slightly denser resume still says everything the candidate did;
 * a roomy one with the last two achievements missing does not. Bullets only
 * start coming off once the densest layout has been measured and still
 * overflows. 0.88 puts body text at ~8.4pt, which is dense but ordinary for a
 * one-page resume.
 */
const PAGE_FIT_LADDER: readonly RenderBudget[] = [
  { bulletCap: MAX_BULLETS_PER_ROLE, capFallback: false, density: 1 },
  { bulletCap: MAX_BULLETS_PER_ROLE, capFallback: true, density: 1 },
  { bulletCap: MAX_BULLETS_PER_ROLE, capFallback: true, density: 0.94 },
  { bulletCap: MAX_BULLETS_PER_ROLE, capFallback: true, density: 0.88 },
  { bulletCap: 5, capFallback: true, density: 0.88 },
  { bulletCap: 4, capFallback: true, density: 0.88 },
  { bulletCap: 3, capFallback: true, density: 0.88 },
];

/**
 * A role's bullets: the model's rewrite when usable, otherwise the stored
 * responsibilities. Never both, never neither-and-empty.
 *
 * Splitting is a **rescue for one specific failure**, not a general pass. The
 * model occasionally returns an entire role as a single element; that blob has
 * to be broken up. But running the splitter over a properly separated set and
 * then re-capping actively destroys content: four rich bullets become six
 * fragments, the cap trims to four, and the tail of the last real bullet is
 * gone. So the split only fires when there is exactly one element and it is
 * long enough to be a blob.
 */
function bulletsFor(
  role: WorkExperienceRole,
  rewritten: string[] | undefined,
  budget: RenderBudget,
): string[] {
  const returned = (rewritten ?? [])
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (returned.length > 0) {
    const isBlob =
      returned.length === 1 && returned[0].length > MAX_BULLET_CHARS;
    const bullets = isBlob ? splitIntoBullets(returned[0]) : returned;
    return bullets.slice(0, budget.bulletCap);
  }

  const fallback = splitIntoBullets(role.responsibilities);
  return budget.capFallback ? fallback.slice(0, budget.bulletCap) : fallback;
}

function Bullet({
  children,
  styles,
}: {
  children: string;
  styles: Styles;
}) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function Section({
  heading,
  children,
  styles,
}: {
  heading: string;
  children: React.ReactNode;
  styles: Styles;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>{heading}</Text>
      {children}
    </View>
  );
}

type Props = {
  profile: Profile;
  prose?: ResumeProse;
  budget?: RenderBudget;
};

/**
 * Pages in a rendered PDF.
 *
 * Read from the page tree's `/Count`, which the PDF spec requires on the root
 * `/Pages` node, falling back to counting `/Type /Page` objects if a writer
 * ever omits it. Byte inspection is the only option here: `@react-pdf/renderer`
 * exposes no page count, and its `onRender` callback is browser-only.
 */
function countPdfPages(buffer: Buffer): number {
  const bytes = buffer.toString("latin1");

  const declared = [
    ...bytes.matchAll(/\/Type\s*\/Pages[\s\S]{0,400}?\/Count\s+(\d+)/g),
  ].map((match) => Number(match[1]));

  if (declared.length > 0) {
    return Math.max(...declared);
  }

  return (bytes.match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
}

/**
 * Renders the document to a single-page PDF buffer.
 *
 * A one-page resume is what the spec calls for, and nothing about the layout
 * enforces it. Measured on the real renderer: three roles of six one-line
 * bullets alongside a 43-skill profile spills onto a second page, while the
 * same profile with two roles fits — so the fit depends on the profile, and no
 * choice of constant can promise it. The guarantee is therefore made by
 * construction: render, count the pages, and step down `PAGE_FIT_LADDER` until
 * it fits.
 *
 * Retries cost CPU only. No model call is repeated, the rewritten prose is
 * reused across attempts, and the common case fits on the first one.
 *
 * Lives here rather than in the route so the JSX stays in a `.tsx` file —
 * Next.js documents route handlers as `route.ts` / `route.js` only — and so
 * every `@react-pdf/renderer` import sits in this one server-only module.
 */
export async function renderResumePdf(
  profile: Profile,
  prose?: ResumeProse,
): Promise<Buffer> {
  let rendered: Buffer | null = null;

  for (const budget of PAGE_FIT_LADDER) {
    rendered = await renderToBuffer(
      <ResumeDocument profile={profile} prose={prose} budget={budget} />,
    );

    if (countPdfPages(rendered) <= 1) {
      return rendered;
    }
  }

  // Every rung overflowed: a profile long enough that even the tightest layout
  // at three bullets per role will not fit. Returning the last attempt beats
  // returning nothing, but it is worth knowing that it happened.
  console.error("[resume-document] could not fit the resume on one page", {
    roles: renderableRoles(profile).length,
    skills: profile.skills.length,
    pages: countPdfPages(rendered as Buffer),
  });

  // Non-null: PAGE_FIT_LADDER is never empty, so the loop always assigned.
  return rendered as Buffer;
}

export function ResumeDocument({
  profile,
  prose,
  budget = PAGE_FIT_LADDER[0],
}: Props) {
  const styles = stylesFor(budget.density);

  // Every section below is conditional: an empty section is omitted entirely
  // rather than rendered as a heading with nothing under it.
  const contact = [
    profile.email,
    profile.phone,
    profile.location,
    profile.linkedin_url,
    profile.portfolio_url,
  ]
    .filter((part): part is string => has(part))
    .join("  ·  ");

  const roles = renderableRoles(profile);

  const summary = has(prose?.summary) ? prose.summary.trim() : "";
  const education = profile.education;
  const educationHeadline =
    education === null ? "" : educationLine(education);

  return (
    <Document
      title={
        has(profile.full_name) ? `${profile.full_name} — Resume` : "Resume"
      }
      author={profile.full_name ?? undefined}
    >
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.name}>{profile.full_name ?? ""}</Text>
          {has(profile.current_title) ? (
            <Text style={styles.title}>{profile.current_title}</Text>
          ) : null}
          {contact.length > 0 ? (
            <Text style={styles.contact}>{contact}</Text>
          ) : null}
        </View>
        <View style={styles.headerRule} />

        {summary.length > 0 ? (
          <Section heading="Summary" styles={styles}>
            <Text>{summary}</Text>
          </Section>
        ) : null}

        {roles.length > 0 ? (
          <Section heading="Experience" styles={styles}>
            {roles.map((role, index) => {
              const dates = roleDates(role);
              const bullets = bulletsFor(
                role,
                prose?.bulletsByRole?.[index],
                budget,
              );
              return (
                <View key={index} style={styles.role} wrap={false}>
                  <View style={styles.roleHeader}>
                    <Text style={styles.roleTitle}>{role.job_title}</Text>
                    {dates.length > 0 ? (
                      <Text style={styles.roleDates}>{dates}</Text>
                    ) : null}
                  </View>
                  {has(role.company) ? (
                    <Text style={styles.roleCompany}>{role.company}</Text>
                  ) : null}
                  {bullets.map((bullet, bulletIndex) => (
                    <Bullet key={bulletIndex} styles={styles}>
                      {bullet}
                    </Bullet>
                  ))}
                </View>
              );
            })}
          </Section>
        ) : null}

        {education !== null &&
        (educationHeadline.length > 0 ||
          has(education.institution) ||
          has(education.year)) ? (
          <Section heading="Education" styles={styles}>
            <View style={styles.educationLine}>
              {educationHeadline.length > 0 ? (
                <Text style={styles.educationDegree}>{educationHeadline}</Text>
              ) : null}
              <Text style={styles.roleCompany}>
                {[education.institution, education.year]
                  .filter((part) => has(part))
                  .join("  ·  ")}
              </Text>
            </View>
          </Section>
        ) : null}

        {profile.skills.length > 0 ? (
          <Section heading="Skills" styles={styles}>
            <View style={styles.skillRow}>
              {profile.skills.map((skill, index) => (
                <Text key={index} style={styles.skill}>
                  {skill}
                </Text>
              ))}
            </View>
          </Section>
        ) : null}
      </Page>
    </Document>
  );
}
