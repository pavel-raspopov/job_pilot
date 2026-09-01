import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AI_ROUTE,
  checkAiRateLimit,
  recordAiCall,
  retryAfterPhrase,
} from "@/lib/ai-rate-limit";
import { createAiClient } from "@/lib/insforge-ai";
import { createInsforgeServer } from "@/lib/insforge-server";
import {
  isEducationDegree,
  isExperienceLevel,
  isRemotePreference,
  isWorkAuthorization,
} from "@/lib/profile-completion";
import type {
  ExtractActionResult,
  ExtractedEducation,
  ExtractedProfile,
  WorkExperienceRole,
} from "@/types";

/**
 * Model used for resume extraction, brokered by the InsForge AI gateway.
 * Swap this one constant to change provider — the request shape is unchanged
 * across the gateway's file-capable models.
 *
 * Measured against a real CV on 8 ground-truth checks (name, city, LinkedIn,
 * employer, degree, institution, skill count, phone):
 *
 *   google/gemini-2.5-flash       8/8   $0.00164   <- chosen
 *   openai/gpt-4.1-mini           7/8   $0.00145   (drops linkedin_url)
 *   openai/gpt-4o-mini            5/8   $0.00046   (drops linkedin, degree, institution)
 *   google/gemini-2.5-flash-lite  fails $0.00030   (misspelled surname, wrong city)
 *   openai/gpt-5-nano             unusable — never calls the tool
 *
 * The cheaper tiers get identity fields wrong, which is the one thing this
 * feature cannot afford: a misspelled name is easy to save without noticing.
 */
const EXTRACTION_MODEL = "google/gemini-2.5-flash";

/**
 * The probe only has to answer "is there any text here", so it runs on the
 * cheapest tier that does it reliably — verified correct on both a blank PDF
 * and a real CV. Accuracy of the extracted *values* is not its job.
 */
const PROBE_MODEL = "google/gemini-2.5-flash-lite";

/**
 * Enough to tell readable text from the EMPTY_DOCUMENT marker, with margin so
 * neither the marker nor a genuine snippet is cut mid-word.
 */
const PROBE_MAX_TOKENS = 24;

/**
 * A real resume's opening twenty words comfortably exceed this. Anything
 * shorter is treated as unreadable — the guard fails closed, toward the error,
 * because the alternative is the model fabricating a profile (decision 12).
 */
const MIN_PROBE_TEXT_CHARS = 20;

/** The profile form accepts at most three work-experience roles. */
const MAX_ROLES = 3;

/** Signed URL lifetime. The gateway fetches it immediately; minutes is plenty. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Extraction measurably takes 20–40s. Without this the route inherits the
 * platform's serverless default (10s on Vercel Hobby, 15s on Pro) and is killed
 * in production even though local dev — which has no limit — passes every test.
 * Must stay >= AI_TIMEOUT_MS (lib/insforge-ai.ts) and within the hosting
 * plan's ceiling.
 */
export const maxDuration = 120;

/**
 * Caps extraction output, the dominant cost driver at $2.50 per M output
 * tokens. A real CV produced 521; this leaves ~3x headroom while bounding the
 * worst case. Truncation would break the tool-call JSON, which fails closed to
 * the unreadable-resume error rather than yielding partial data.
 */
const EXTRACTION_MAX_TOKENS = 1536;

const AUTH_ERROR = "You must be signed in to extract from your resume.";
const NO_RESUME_ERROR = "Upload a resume before extracting.";
const UNREADABLE_ERROR =
  "Could not read this resume. Please try a different file.";
const SERVICE_ERROR = "Could not extract from your resume. Please try again.";
const RATE_LIMIT_ERROR = "Too many extractions in the last hour.";


/**
 * Readability probe. Deliberately has NO tool attached: a tool schema pressures
 * the model into producing a plausible person for a document it cannot read,
 * and no prompt wording reliably suppresses that. Asked plainly, with nothing
 * to fill in, it reports emptiness instead.
 */
const READABILITY_PROMPT = [
  "Reply with the first twenty words of readable text in this document, copied verbatim.",
  "If the document contains no readable text at all, reply with exactly EMPTY_DOCUMENT.",
  "Do not describe the document and do not invent content.",
].join("\n");

const PROMPT = [
  "Extract this resume into the record_profile tool.",
  "Rules:",
  "- If you can read no resume text in the document — it is empty, blank, corrupt, or unrelated — do NOT call the tool. Reply with exactly EMPTY_DOCUMENT instead. Never invent a person, employer, or skill.",
  "- Otherwise call record_profile and set document_contains_resume true.",
  "- Dates use YYYY-MM. For a role the person still holds, set currently_working true and omit end_date.",
  "- Return at most 3 roles, most recent first.",
  "- Omit any field the resume does not state. Do not invent values.",
  "- experience_level is an exception: infer it from the job titles and total years of experience even when the resume never names a level.",
  "- skills, industries, job_titles_seeking and preferred_locations are lists of short plain strings.",
  "- Include the full URL scheme on linkedin_url and portfolio_url.",
].join("\n");

const EXTRACTION_TOOL = {
  type: "function" as const,
  function: {
    name: "record_profile",
    description: "Record the profile fields extracted from the resume.",
    parameters: {
      type: "object",
      required: ["document_contains_resume"],
      properties: {
        document_contains_resume: {
          type: "boolean",
          description:
            "False when the document has no readable resume content. All other fields must then be empty.",
        },
        full_name: { type: "string" },
        phone: { type: "string" },
        location: { type: "string", description: "City, Country" },
        linkedin_url: { type: "string" },
        portfolio_url: { type: "string", description: "Portfolio or GitHub" },
        work_authorization: {
          type: "string",
          enum: ["citizen", "permanent_resident", "visa_required"],
        },
        current_title: { type: "string" },
        experience_level: {
          type: "string",
          enum: ["junior", "mid", "senior", "lead"],
        },
        years_experience: { type: "number" },
        skills: { type: "array", items: { type: "string" } },
        industries: { type: "array", items: { type: "string" } },
        job_titles_seeking: { type: "array", items: { type: "string" } },
        remote_preference: {
          type: "string",
          enum: ["remote", "onsite", "hybrid", "any"],
        },
        preferred_locations: { type: "array", items: { type: "string" } },
        salary_expectation: { type: "string" },
        education: {
          type: "object",
          description: "Highest degree only",
          properties: {
            degree: {
              type: "string",
              enum: ["high_school", "associate", "bachelors", "masters", "phd"],
            },
            field: { type: "string" },
            institution: { type: "string" },
            year: { type: "string", description: "Graduation year, YYYY" },
          },
        },
        work_experience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              company: { type: "string" },
              job_title: { type: "string" },
              start_date: { type: "string", description: "YYYY-MM" },
              end_date: { type: "string", description: "YYYY-MM" },
              currently_working: { type: "boolean" },
              responsibilities: { type: "string" },
            },
          },
        },
      },
    },
  },
};

/**
 * Model output is untrusted. Every field is optional and individually
 * `.catch(undefined)`, so one malformed value drops that field instead of
 * discarding an otherwise good extraction.
 */
const nonEmpty = z.string().trim().min(1);

// The guard has already proved the narrowing; the cast just tells the compiler.
const enumFrom = <T extends string>(guard: (value: string) => value is T) =>
  nonEmpty
    .refine(guard)
    .transform((value) => value as T)
    .optional()
    .catch(undefined);

const stringList = z
  .array(z.unknown())
  .transform((items) =>
    items.filter((item): item is string => typeof item === "string" && item.trim().length > 0),
  )
  .transform((items) => items.map((item) => item.trim()))
  .optional()
  .catch(undefined);

const optionalText = nonEmpty.optional().catch(undefined);

const extractionSchema = z.object({
  document_contains_resume: z.boolean().optional().catch(undefined),
  full_name: optionalText,
  phone: optionalText,
  location: optionalText,
  linkedin_url: optionalText,
  portfolio_url: optionalText,
  work_authorization: enumFrom(isWorkAuthorization),
  current_title: optionalText,
  experience_level: enumFrom(isExperienceLevel),
  years_experience: z
    .number()
    .finite()
    .nonnegative()
    .optional()
    .catch(undefined),
  skills: stringList,
  industries: stringList,
  job_titles_seeking: stringList,
  remote_preference: enumFrom(isRemotePreference),
  preferred_locations: stringList,
  salary_expectation: optionalText,
  education: z
    .object({
      degree: enumFrom(isEducationDegree),
      field: optionalText,
      institution: optionalText,
      year: optionalText,
    })
    .optional()
    .catch(undefined),
  work_experience: z
    .array(
      z
        .object({
          company: optionalText,
          job_title: optionalText,
          start_date: optionalText,
          end_date: optionalText,
          currently_working: z.boolean().optional().catch(undefined),
          responsibilities: optionalText,
        })
        .catch({}),
    )
    .optional()
    .catch(undefined),
});

function toProfile(parsed: z.infer<typeof extractionSchema>): ExtractedProfile {
  const profile: ExtractedProfile = {};

  if (parsed.full_name !== undefined) profile.full_name = parsed.full_name;
  if (parsed.phone !== undefined) profile.phone = parsed.phone;
  if (parsed.location !== undefined) profile.location = parsed.location;
  if (parsed.linkedin_url !== undefined)
    profile.linkedin_url = parsed.linkedin_url;
  if (parsed.portfolio_url !== undefined)
    profile.portfolio_url = parsed.portfolio_url;
  if (parsed.work_authorization !== undefined)
    profile.work_authorization = parsed.work_authorization;
  if (parsed.current_title !== undefined)
    profile.current_title = parsed.current_title;
  if (parsed.experience_level !== undefined)
    profile.experience_level = parsed.experience_level;
  if (parsed.remote_preference !== undefined)
    profile.remote_preference = parsed.remote_preference;
  if (parsed.salary_expectation !== undefined)
    profile.salary_expectation = parsed.salary_expectation;
  if (parsed.years_experience !== undefined)
    profile.years_experience = parsed.years_experience;

  if (parsed.skills?.length) profile.skills = parsed.skills;
  if (parsed.industries?.length) profile.industries = parsed.industries;
  if (parsed.job_titles_seeking?.length)
    profile.job_titles_seeking = parsed.job_titles_seeking;
  if (parsed.preferred_locations?.length)
    profile.preferred_locations = parsed.preferred_locations;

  // Only the sub-fields the resume actually states. Returning the full
  // `Education` shape with `null` / "" placeholders made "the resume is silent
  // about this" indistinguishable from "the resume says this is empty", and the
  // form replaced the whole object — so a resume naming only an institution
  // wiped a degree, field and year the user had already filled in, quietly
  // turning a complete profile incomplete.
  const education = parsed.education;
  if (education !== undefined) {
    const stated: ExtractedEducation = {};
    if (education.degree !== undefined) stated.degree = education.degree;
    if (education.field !== undefined) stated.field = education.field;
    if (education.institution !== undefined) {
      stated.institution = education.institution;
    }
    if (education.year !== undefined) stated.year = education.year;

    if (Object.keys(stated).length > 0) {
      profile.education = stated;
    }
  }

  const roles = (parsed.work_experience ?? [])
    .filter((role) => role.company || role.job_title)
    .slice(0, MAX_ROLES)
    .map((role): WorkExperienceRole => {
      const currentlyWorking = role.currently_working === true;
      return {
        company: role.company ?? "",
        job_title: role.job_title ?? "",
        start_date: role.start_date ?? "",
        end_date: currentlyWorking ? null : (role.end_date ?? null),
        currently_working: currentlyWorking,
        responsibilities: role.responsibilities ?? "",
      };
    });

  if (roles.length > 0) {
    profile.work_experience = roles;
  }

  return profile;
}

function keyBelongsToUser(key: string, userId: string): boolean {
  return key.split("/")[0] === userId;
}

function fail(error: string): NextResponse {
  return NextResponse.json<ExtractActionResult>({ success: false, error });
}

export async function POST(): Promise<NextResponse> {
  try {
    const insforge = await createInsforgeServer();
    const { data: userData, error: authError } =
      await insforge.auth.getCurrentUser();
    const userId = userData?.user?.id;

    if (authError || !userId) {
      return fail(AUTH_ERROR);
    }

    const { data: rows, error: loadError } = await insforge.database
      .from("profiles")
      .select("resume_pdf_key")
      .eq("id", userId)
      .limit(1);

    if (loadError) {
      console.error("[api/resume/extract] load", loadError);
      return fail(SERVICE_ERROR);
    }

    const row = Array.isArray(rows) ? rows[0] : undefined;
    const resumeKey =
      row && typeof row === "object" && "resume_pdf_key" in row
        ? (row as { resume_pdf_key: unknown }).resume_pdf_key
        : null;

    if (typeof resumeKey !== "string" || resumeKey.length === 0) {
      return fail(NO_RESUME_ERROR);
    }

    if (!keyBelongsToUser(resumeKey, userId)) {
      console.error("[api/resume/extract] key prefix mismatch");
      return fail(SERVICE_ERROR);
    }

    const { data: signed, error: signError } = await insforge.storage
      .from("resumes")
      .createSignedUrl(resumeKey, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      console.error("[api/resume/extract] sign", signError);
      return fail(SERVICE_ERROR);
    }

    // Checked here rather than at the top of the handler: the calls above are
    // free, so a user whose resume is missing should get that error rather than
    // a rate-limit one. Everything below this line is billed.
    const verdict = await checkAiRateLimit(
      insforge,
      userId,
      AI_ROUTE.resumeExtract,
    );
    if (!verdict.allowed) {
      return fail(
        `${RATE_LIMIT_ERROR} Please try again ${retryAfterPhrase(
          verdict.retryAfterSeconds,
        )}.`,
      );
    }

    // Recorded before the call, not after. Extraction is billed whether or not
    // the response turns out to be usable, so the tally has to count attempts.
    await recordAiCall(insforge, userId, AI_ROUTE.resumeExtract);

    const aiClient = await createAiClient();

    const probe = await aiClient.ai.chat.completions.create({
      model: PROBE_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: READABILITY_PROMPT },
            {
              type: "file",
              file: { filename: "resume.pdf", file_data: signed.signedUrl },
            },
          ],
        },
      ],
      fileParser: { enabled: true },
      maxTokens: PROBE_MAX_TOKENS,
    });

    const probeText: string = (
      probe?.choices?.[0]?.message?.content ?? ""
    ).trim();

    // Fails closed. Matched loosely so a truncated or punctuated marker still
    // counts, and backed by a length floor so a stray short reply cannot be
    // mistaken for readable prose.
    const declaredEmpty = /EMPTY[\W_]*DOC/i.test(probeText);
    const tooShort =
      probeText.replace(/\s+/g, " ").length < MIN_PROBE_TEXT_CHARS;

    if (probeText.length === 0 || declaredEmpty || tooShort) {
      console.error("[api/resume/extract] probe found no readable text", {
        declaredEmpty,
        tooShort,
        length: probeText.length,
      });
      return fail(UNREADABLE_ERROR);
    }

    const completion = await aiClient.ai.chat.completions.create({
      model: EXTRACTION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "file",
              file: { filename: "resume.pdf", file_data: signed.signedUrl },
            },
          ],
        },
      ],
      maxTokens: EXTRACTION_MAX_TOKENS,
      tools: [EXTRACTION_TOOL],
      // Deliberately "auto", not "required". Forcing a tool call on a document
      // with nothing to read pressures the model into inventing a plausible
      // person; left free, it reliably declines instead. No tool call is
      // therefore the unreadable-resume signal, handled below.
      toolChoice: "auto",
      fileParser: { enabled: true },
    });

    const toolCall = completion?.choices?.[0]?.message?.tool_calls?.[0];
    const rawArguments = toolCall?.function?.arguments;

    if (typeof rawArguments !== "string") {
      console.error("[api/resume/extract] no tool call in completion");
      return fail(UNREADABLE_ERROR);
    }

    let parsedArguments: unknown;
    try {
      parsedArguments = JSON.parse(rawArguments);
    } catch {
      console.error("[api/resume/extract] tool arguments were not valid JSON");
      return fail(UNREADABLE_ERROR);
    }

    const validated = extractionSchema.safeParse(parsedArguments);
    if (!validated.success) {
      console.error("[api/resume/extract] schema rejected the extraction");
      return fail(UNREADABLE_ERROR);
    }

    // `toolChoice: "required"` forces a tool call, so a document with nothing
    // to read pressures the model into inventing a plausible person. The
    // explicit flag gives it a way to say "nothing here" instead. Treat a
    // missing flag as unreadable too — a real extraction always sets it.
    if (validated.data.document_contains_resume !== true) {
      console.error("[api/resume/extract] model reported no resume content");
      return fail(UNREADABLE_ERROR);
    }

    const profile = toProfile(validated.data);
    if (Object.keys(profile).length === 0) {
      return fail(UNREADABLE_ERROR);
    }

    return NextResponse.json<ExtractActionResult>({ success: true, profile });
  } catch (error) {
    console.error("[api/resume/extract] unexpected", error);
    return fail(SERVICE_ERROR);
  }
}
