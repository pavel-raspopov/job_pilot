import { revalidatePath } from "next/cache";
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
import { parseProfileRow } from "@/lib/parse-profile";
import { getProfileCompletion } from "@/lib/profile-completion";
import type { GenerateActionResult, Profile } from "@/types";
import {
  MAX_BULLETS_PER_ROLE,
  renderResumePdf,
  renderableRoles,
  type ResumeProse,
} from "./resume-document";

/**
 * Model used to rewrite stored profile text into resume prose, brokered by the
 * InsForge AI gateway.
 *
 * Unlike extraction, this task never handles identity fields — the tool schema
 * below carries prose only — so a weaker model produces flat writing rather
 * than a misspelled name, and the bar is correspondingly lower. Measured
 * head-to-head on the fixture profile (2 roles), token counts from the
 * gateway's own `usage`:
 *
 *   google/gemini-2.5-flash       779 in / 264 out   ~$0.00089   <- chosen
 *   google/gemini-2.5-flash-lite  779 in / 254 out   ~$0.00018
 *
 * Both produced 8 usable bullets on one page with a sound summary, and
 * flash-lite is ~5x cheaper. Flash wins on one specific point: the prompt asks
 * for past tense with **present tense for a currently-held role**, and only
 * flash obeyed it. flash-lite wrote the current job in the past tense, which
 * reads as though the candidate has already left — the kind of error a
 * recruiter notices.
 *
 * At ~$0.00089 the free plan's $1/month covers roughly 1,100 generations, so
 * there is no cost pressure to accept that. Revisit if volume changes.
 */
const GENERATION_MODEL = "google/gemini-2.5-flash";

/**
 * Caps output, the dominant cost driver. A summary plus three roles of four
 * bullets runs a few hundred tokens; this leaves generous headroom while
 * bounding the worst case. Truncation breaks the tool-call JSON, which falls
 * back to stored profile text rather than yielding a half-written resume.
 */
const GENERATION_MAX_TOKENS = 1024;

/** Signed URL lifetime for the download link. Deliberately short-lived. */
const SIGNED_URL_TTL_SECONDS = 300;

/** One generated resume per user, alongside the uploaded one at resume.pdf. */
const GENERATED_RESUME_FILENAME = "generated-resume.pdf";

/**
 * Without this the route inherits the platform's serverless default (10s on
 * Vercel Hobby, 15s on Pro) and is killed in production even though local dev
 * — which has no limit — passes every test. This is the failure mode Feature
 * 07 hit; every AI route needs the export.
 *
 * Must stay >= AI_TIMEOUT_MS (lib/insforge-ai.ts) and within the hosting
 * plan's ceiling.
 */
export const maxDuration = 120;

const AUTH_ERROR = "You must be signed in to generate a resume.";
const NO_PROFILE_ERROR =
  "Complete and save your profile before generating a resume.";
const INCOMPLETE_ERROR =
  "Complete the missing profile fields before generating a resume.";
const SERVICE_ERROR = "Could not generate your resume. Please try again.";
const RATE_LIMIT_ERROR = "Too many resumes generated in the last hour.";

const PROMPT = [
  "You are rewriting a candidate's own profile data into resume prose.",
  "Call the record_resume tool.",
  "Rules:",
  "- Write a professional summary of 2-3 sentences in the third person, with no pronouns and no name.",
  `- Write ONE bullet per distinct achievement in that role's responsibilities, up to ${MAX_BULLETS_PER_ROLE}. Use past tense (present tense for a current role).`,
  "- Cover EVERY achievement the input lists. Do not merge two into one and do not drop the last one to be brief. Fewer bullets than the input has achievements is a failure.",
  "- Keep the specifics: technologies, numbers, percentages, product and market names. A bullet that drops them is worse than the input.",
  "- Each bullet is a SEPARATE array element. Never return several achievements in one element, and never return one element containing the whole role.",
  "- Start bullets with a strong verb. Do not begin with 'Responsible for'.",
  "- Use ONLY the facts given. Never introduce an employer, title, date, product, metric, technology, or number that is not in the input.",
  "- If a role's responsibilities are empty, return an empty bullet list for it. Do not invent work.",
  "- Do not restate the person's name, contact details, education, or skill list — those are rendered separately.",
  "- Plain text only. No markdown, no bullet characters, no leading dashes.",
].join("\n");

const GENERATION_TOOL = {
  type: "function" as const,
  function: {
    name: "record_resume",
    description: "Record the rewritten resume prose.",
    parameters: {
      type: "object",
      required: ["summary", "roles"],
      properties: {
        summary: {
          type: "string",
          description: "Professional summary, 2-3 sentences.",
        },
        roles: {
          type: "array",
          description:
            "One entry per input role, in the same order as the input.",
          items: {
            type: "object",
            required: ["role_index", "bullets"],
            properties: {
              role_index: {
                type: "number",
                description: "Zero-based index of the role in the input list.",
              },
              bullets: {
                type: "array",
                maxItems: MAX_BULLETS_PER_ROLE,
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

/**
 * Model output is untrusted and every part is optional: a malformed field
 * drops to the stored profile text rather than discarding the whole document.
 *
 * Note what is NOT here — no name, employer, title, date, institution, degree,
 * or skill. Those never round-trip through the model, so there is no field it
 * could corrupt. This is the structural form of "do not invent facts".
 */
const proseSchema = z.object({
  summary: z.string().trim().min(1).optional().catch(undefined),
  roles: z
    .array(
      z
        .object({
          role_index: z.number().int().nonnegative().optional().catch(undefined),
          bullets: z
            .array(z.unknown())
            .transform((items) =>
              items
                .filter((item): item is string => typeof item === "string")
                .map((item) => item.trim())
                .filter((item) => item.length > 0),
            )
            .optional()
            .catch(undefined),
        })
        .catch({}),
    )
    .optional()
    .catch(undefined),
});

function toProse(parsed: z.infer<typeof proseSchema>): ResumeProse {
  const prose: ResumeProse = {};

  if (parsed.summary !== undefined) {
    prose.summary = parsed.summary;
  }

  const bulletsByRole: Record<number, string[]> = {};
  for (const entry of parsed.roles ?? []) {
    if (entry.role_index === undefined || !entry.bullets?.length) {
      continue;
    }
    bulletsByRole[entry.role_index] = entry.bullets.slice(
      0,
      MAX_BULLETS_PER_ROLE,
    );
  }

  if (Object.keys(bulletsByRole).length > 0) {
    prose.bulletsByRole = bulletsByRole;
  }

  return prose;
}

/**
 * Only the facts the model is allowed to see — prose inputs, nothing more.
 *
 * `renderableRoles` rather than `profile.work_experience`: `role_index` is how
 * the rewritten bullets find their way back to a role, so it has to index the
 * list the document actually renders. Indexing the raw column meant a role the
 * document drops (no company and no job title, which `stripBlankRoles` still
 * persists) shifted every later role's bullets onto the wrong employer. Using
 * one shared list makes that mismatch unrepresentable — and it also stops us
 * paying the model to rewrite a role that will never be printed.
 */
function buildModelInput(profile: Profile): string {
  const roles = renderableRoles(profile).map((role, index) => ({
    role_index: index,
    job_title: role.job_title,
    company: role.company,
    currently_working: role.currently_working,
    responsibilities: role.responsibilities,
  }));

  return JSON.stringify({
    current_title: profile.current_title,
    experience_level: profile.experience_level,
    years_experience: profile.years_experience,
    skills: profile.skills,
    industries: profile.industries,
    roles,
  });
}

function keyBelongsToUser(key: string, userId: string): boolean {
  return key.split("/")[0] === userId;
}

function fail(error: string): NextResponse {
  return NextResponse.json<GenerateActionResult>({ success: false, error });
}

/**
 * Asks the gateway for rewritten prose. Never throws: any failure returns an
 * empty result and the document renders from stored profile text instead
 * (design decision 3 — a failed rewrite degrades to plain-but-correct).
 */
async function rewriteProse(profile: Profile): Promise<ResumeProse> {
  try {
    const aiClient = await createAiClient();
    const completion = await aiClient.ai.chat.completions.create({
      model: GENERATION_MODEL,
      messages: [
        { role: "user", content: `${PROMPT}\n\n${buildModelInput(profile)}` },
      ],
      maxTokens: GENERATION_MAX_TOKENS,
      tools: [GENERATION_TOOL],
      // Safe to force here, unlike extraction: the input is our own validated
      // profile row rather than a document the model might not be able to
      // read, so there is no unreadable case to fabricate around.
      toolChoice: "required",
    });

    const rawArguments =
      completion?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;

    if (typeof rawArguments !== "string") {
      console.error("[api/resume/generate] no tool call in completion");
      return {};
    }

    let parsedArguments: unknown;
    try {
      parsedArguments = JSON.parse(rawArguments);
    } catch {
      console.error("[api/resume/generate] tool arguments were not valid JSON");
      return {};
    }

    const validated = proseSchema.safeParse(parsedArguments);
    if (!validated.success) {
      console.error("[api/resume/generate] schema rejected the rewrite");
      return {};
    }

    return toProse(validated.data);
  } catch (error) {
    console.error("[api/resume/generate] rewrite failed", error);
    return {};
  }
}

type LoadedProfile = {
  insforge: Awaited<ReturnType<typeof createInsforgeServer>>;
  userId: string;
  profile: Profile;
};

/** Auth + profile load, shared by both verbs. Returns the failure response. */
async function loadProfile(): Promise<
  { ok: true; value: LoadedProfile } | { ok: false; response: NextResponse }
> {
  const insforge = await createInsforgeServer();
  const { data: userData, error: authError } =
    await insforge.auth.getCurrentUser();
  const userId = userData?.user?.id;

  if (authError || !userId) {
    return { ok: false, response: fail(AUTH_ERROR) };
  }

  const { data: rows, error: loadError } = await insforge.database
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .limit(1);

  if (loadError) {
    console.error("[api/resume/generate] load", loadError);
    return { ok: false, response: fail(SERVICE_ERROR) };
  }

  const profile =
    Array.isArray(rows) && rows.length > 0 ? parseProfileRow(rows[0]) : null;

  if (profile === null) {
    return { ok: false, response: fail(NO_PROFILE_ERROR) };
  }

  return { ok: true, value: { insforge, userId, profile } };
}

/**
 * Returns a fresh download link for a resume that was generated earlier,
 * without regenerating it.
 *
 * Signed URLs expire in minutes, so a link handed out on one page load is dead
 * by the next. Without this, a user who reloads has no way to reach a document
 * that already exists and must pay for another model call to get it back —
 * which is what `generated_resume_key` is recorded for.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const loaded = await loadProfile();
    if (!loaded.ok) {
      return loaded.response;
    }

    const { insforge, userId, profile } = loaded.value;
    const key = profile.generated_resume_key;

    if (key === null || !keyBelongsToUser(key, userId)) {
      // Not an error: most profiles simply have never generated one.
      return NextResponse.json<GenerateActionResult>({ success: false });
    }

    const { data: signed, error: signError } = await insforge.storage
      .from("resumes")
      .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      console.error("[api/resume/generate] sign existing", signError);
      return NextResponse.json<GenerateActionResult>({ success: false });
    }

    return NextResponse.json<GenerateActionResult>({
      success: true,
      downloadUrl: signed.signedUrl,
    });
  } catch (error) {
    console.error("[api/resume/generate] unexpected GET", error);
    return NextResponse.json<GenerateActionResult>({ success: false });
  }
}

export async function POST(): Promise<NextResponse> {
  try {
    const loaded = await loadProfile();
    if (!loaded.ok) {
      return loaded.response;
    }

    const { insforge, userId, profile } = loaded.value;

    // Same helper the attention banner uses, so the gate and the list of
    // missing fields the user is shown can never drift apart.
    if (!getProfileCompletion(profile).isComplete) {
      return fail(INCOMPLETE_ERROR);
    }

    // After the completeness gate, so an incomplete profile still gets the
    // message that actually helps. Everything below this line is billed.
    const verdict = await checkAiRateLimit(
      insforge,
      userId,
      AI_ROUTE.resumeGenerate,
    );
    if (!verdict.allowed) {
      return fail(
        `${RATE_LIMIT_ERROR} Please try again ${retryAfterPhrase(
          verdict.retryAfterSeconds,
        )}.`,
      );
    }

    // Recorded before the call, not after: the rewrite is billed even when it
    // fails and the document falls back to stored profile text.
    await recordAiCall(insforge, userId, AI_ROUTE.resumeGenerate);

    const prose = await rewriteProse(profile);
    const buffer = await renderResumePdf(profile, prose);

    // `upload()` takes File | Blob, not a Node Buffer — which is exactly what
    // renderToBuffer returns. Uploading to an existing key replaces it (the
    // SDK documents standard PUT semantics), so regeneration needs no flag.
    //
    // The Uint8Array copy is not ceremony: a Node Buffer may be backed by a
    // SharedArrayBuffer, so `Buffer` is not assignable to `BlobPart` under
    // strict types. Copying gives a view over a plain ArrayBuffer.
    const file = new File(
      [new Uint8Array(buffer)],
      GENERATED_RESUME_FILENAME,
      { type: "application/pdf" },
    );
    const objectPath = `${userId}/${GENERATED_RESUME_FILENAME}`;

    const { data: uploaded, error: uploadError } = await insforge.storage
      .from("resumes")
      .upload(objectPath, file);

    if (uploadError || !uploaded) {
      console.error("[api/resume/generate] upload", uploadError);
      return fail(SERVICE_ERROR);
    }

    if (!keyBelongsToUser(uploaded.key, userId)) {
      console.error("[api/resume/generate] upload key prefix mismatch");
      await insforge.storage.from("resumes").remove(uploaded.key);
      return fail(SERVICE_ERROR);
    }

    // Only the generated pair is written. resume_pdf_url / resume_pdf_key are
    // deliberately absent: they point at the resume the user uploaded, which
    // is also the key extraction reads.
    //
    // `updated_at` is bumped on purpose. Generating is not a profile edit, but
    // `uploadResume` already bumps it when it writes its own storage pointers
    // (actions/profile.ts), so the column means "row last written" here. Making
    // this one path the exception would be the inconsistency, not the fix.
    const { error: persistError } = await insforge.database
      .from("profiles")
      .update({
        generated_resume_url: uploaded.url,
        generated_resume_key: uploaded.key,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (persistError) {
      console.error("[api/resume/generate] persist", persistError);
      return fail(SERVICE_ERROR);
    }

    // `generated_resume_key` is what tells /profile to offer the download again
    // on a later visit, and the page reads it server-side. Without this the
    // freshly written pointer is invisible to the already-rendered page, so a
    // soft navigation back could show no download for a document that exists.
    revalidatePath("/profile");

    const { data: signed, error: signError } = await insforge.storage
      .from("resumes")
      .createSignedUrl(uploaded.key, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      console.error("[api/resume/generate] sign", signError);
      return fail(SERVICE_ERROR);
    }

    return NextResponse.json<GenerateActionResult>({
      success: true,
      downloadUrl: signed.signedUrl,
    });
  } catch (error) {
    console.error("[api/resume/generate] unexpected", error);
    return fail(SERVICE_ERROR);
  }
}
