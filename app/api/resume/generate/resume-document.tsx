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

const styles = StyleSheet.create({
  page: {
    paddingVertical: 40,
    paddingHorizontal: 48,
    fontFamily: FONT_FAMILY,
    fontSize: 9.5,
    lineHeight: 1.5,
    color: COLOR.textDark,
  },

  name: {
    fontSize: 22,
    fontFamily: FONT_FAMILY,
    fontWeight: 600,
    color: COLOR.textPrimary,
    // Explicit, and not inherited. The page's lineHeight: 1.5 did not give this
    // 22pt line a tall enough box: the name's baseline landed 6pt above the
    // title's and the two overlapped on the rendered page.
    lineHeight: 1.25,
  },
  title: {
    fontSize: 11,
    color: COLOR.accent,
    marginTop: 4,
  },
  contact: {
    fontSize: 9,
    color: COLOR.textSecondary,
    marginTop: 6,
  },
  headerRule: {
    marginTop: 14,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },

  section: { marginBottom: 16 },
  sectionHeading: {
    fontSize: 9,
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
    marginBottom: 7,
  },

  role: { marginBottom: 11 },
  roleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  roleTitle: {
    fontSize: 10.5,
    fontFamily: FONT_FAMILY,
    fontWeight: 600,
    color: COLOR.textPrimary,
  },
  roleCompany: {
    fontSize: 9.5,
    color: COLOR.textSecondary,
  },
  roleDates: {
    fontSize: 8.5,
    color: COLOR.textSecondary,
  },

  bulletRow: {
    flexDirection: "row",
    marginTop: 3,
  },
  bulletMark: {
    width: 10,
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
    fontSize: 9,
    marginRight: 8,
    marginBottom: 2,
    color: COLOR.textDark,
  },

  educationLine: { marginBottom: 3 },
  educationDegree: {
    fontSize: 10,
    fontFamily: FONT_FAMILY,
    fontWeight: 600,
    color: COLOR.textPrimary,
  },
});

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
 *
 * The fallback is deliberately left uncapped: the cap governs what we ask the
 * model to write, and silently dropping the user's own hand-entered text would
 * lose information. A long fallback is the profile telling us it is long.
 */
function bulletsFor(
  role: WorkExperienceRole,
  rewritten: string[] | undefined,
): string[] {
  const returned = (rewritten ?? [])
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (returned.length > 0) {
    const isBlob =
      returned.length === 1 && returned[0].length > MAX_BULLET_CHARS;
    const bullets = isBlob ? splitIntoBullets(returned[0]) : returned;
    return bullets.slice(0, MAX_BULLETS_PER_ROLE);
  }

  return splitIntoBullets(role.responsibilities);
}

function Bullet({ children }: { children: string }) {
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
}: {
  heading: string;
  children: React.ReactNode;
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
};

/**
 * Renders the document to a PDF buffer.
 *
 * Lives here rather than in the route so the JSX stays in a `.tsx` file —
 * Next.js documents route handlers as `route.ts` / `route.js` only — and so
 * every `@react-pdf/renderer` import sits in this one server-only module.
 */
export function renderResumePdf(
  profile: Profile,
  prose?: ResumeProse,
): Promise<Buffer> {
  return renderToBuffer(<ResumeDocument profile={profile} prose={prose} />);
}

export function ResumeDocument({ profile, prose }: Props) {
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

  const roles = (profile.work_experience ?? []).filter(
    (role) => has(role.company) || has(role.job_title),
  );

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
          <Section heading="Summary">
            <Text>{summary}</Text>
          </Section>
        ) : null}

        {roles.length > 0 ? (
          <Section heading="Experience">
            {roles.map((role, index) => {
              const dates = roleDates(role);
              const bullets = bulletsFor(role, prose?.bulletsByRole?.[index]);
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
                    <Bullet key={bulletIndex}>{bullet}</Bullet>
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
          <Section heading="Education">
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
          <Section heading="Skills">
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
