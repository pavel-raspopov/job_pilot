"use server";

import { revalidatePath } from "next/cache";
import { createInsforgeServer } from "@/lib/insforge-server";
import { parseProfileRow } from "@/lib/parse-profile";
import {
  getProfileCompletion,
  isEducationDegree,
  isExperienceLevel,
  isRemotePreference,
  isWorkAuthorization,
  stripBlankRoles,
} from "@/lib/profile-completion";
import type { Education, Profile, WorkExperienceRole } from "@/types";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const SAVE_ERROR = "Failed to save profile";
const UPLOAD_ERROR = "Failed to upload resume";

export type ProfileActionResult = {
  success: boolean;
  error?: string;
  completedNow?: boolean;
};

function formText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function splitCommaList(value: string | null): string[] {
  if (value === null) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseJsonArray(raw: string | null): string[] {
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRolesJson(raw: string | null): WorkExperienceRole[] {
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const roles: WorkExperienceRole[] = [];
    for (const item of parsed) {
      if (!isRecord(item)) {
        continue;
      }
      const currentlyWorking = item.currently_working === true;
      const endDate =
        typeof item.end_date === "string" && item.end_date.trim().length > 0
          ? item.end_date.trim()
          : null;
      roles.push({
        company: typeof item.company === "string" ? item.company.trim() : "",
        job_title:
          typeof item.job_title === "string" ? item.job_title.trim() : "",
        start_date:
          typeof item.start_date === "string" ? item.start_date.trim() : "",
        end_date: currentlyWorking ? null : endDate,
        currently_working: currentlyWorking,
        responsibilities:
          typeof item.responsibilities === "string"
            ? item.responsibilities.trim()
            : "",
      });
    }
    return stripBlankRoles(roles);
  } catch {
    return [];
  }
}

function optionalEnum<T extends string>(
  value: string | null,
  guard: (candidate: string) => candidate is T,
): { ok: true; value: T | null } | { ok: false } {
  if (value === null) {
    return { ok: true, value: null };
  }
  if (!guard(value)) {
    return { ok: false };
  }
  return { ok: true, value };
}

async function getAuthedClient(): Promise<
  | {
      ok: true;
      insforge: Awaited<ReturnType<typeof createInsforgeServer>>;
      userId: string;
      email: string | null;
    }
  | { ok: false; error: string }
> {
  const insforge = await createInsforgeServer();
  const { data, error } = await insforge.auth.getCurrentUser();
  if (error || !data?.user?.id) {
    return { ok: false, error: "You must be signed in to save your profile." };
  }
  return {
    ok: true,
    insforge,
    userId: data.user.id,
    email: data.user.email ?? null,
  };
}

async function loadProfileRow(
  insforge: Awaited<ReturnType<typeof createInsforgeServer>>,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await insforge.database
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .limit(1);

  if (error) {
    console.error("[actions/profile] load", error);
    return null;
  }

  const rows: unknown = data;
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  return parseProfileRow(rows[0]);
}

function keyBelongsToUser(key: string, userId: string): boolean {
  const firstSegment = key.split("/")[0];
  return firstSegment === userId;
}

export async function saveProfile(
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const auth = await getAuthedClient();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }

    const workAuthorization = optionalEnum(
      formText(formData, "work_authorization"),
      isWorkAuthorization,
    );
    const experienceLevel = optionalEnum(
      formText(formData, "experience_level"),
      isExperienceLevel,
    );
    const remotePreference = optionalEnum(
      formText(formData, "remote_preference"),
      isRemotePreference,
    );
    const educationDegree = optionalEnum(
      formText(formData, "education_degree"),
      isEducationDegree,
    );

    if (
      !workAuthorization.ok ||
      !experienceLevel.ok ||
      !remotePreference.ok ||
      !educationDegree.ok
    ) {
      return { success: false, error: "One or more dropdown values are invalid." };
    }

    const yearsRaw = formText(formData, "years_experience");
    let yearsExperience: number | null = null;
    if (yearsRaw !== null) {
      const parsed = Number(yearsRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return { success: false, error: "Years of experience must be a number." };
      }
      yearsExperience = parsed;
    }

    const educationField = formText(formData, "education_field");
    const educationInstitution = formText(formData, "education_institution");
    const educationYear = formText(formData, "education_year");
    const education: Education | null =
      educationDegree.value === null &&
      educationField === null &&
      educationInstitution === null &&
      educationYear === null
        ? null
        : {
            degree: educationDegree.value,
            field: educationField ?? "",
            institution: educationInstitution ?? "",
            year: educationYear ?? "",
          };

    const completionInput = {
      full_name: formText(formData, "full_name"),
      phone: formText(formData, "phone"),
      location: formText(formData, "location"),
      work_authorization: workAuthorization.value,
      current_title: formText(formData, "current_title"),
      experience_level: experienceLevel.value,
      years_experience: yearsExperience,
      skills: parseJsonArray(formText(formData, "skills")),
      work_experience: parseRolesJson(formText(formData, "work_experience")),
      education,
      job_titles_seeking: splitCommaList(formText(formData, "job_titles_seeking")),
      remote_preference: remotePreference.value,
    };

    const completion = getProfileCompletion(completionInput);
    const existing = await loadProfileRow(auth.insforge, auth.userId);

    const payload = {
      id: auth.userId,
      full_name: completionInput.full_name,
      email: auth.email,
      phone: completionInput.phone,
      location: completionInput.location,
      current_title: completionInput.current_title,
      experience_level: completionInput.experience_level,
      years_experience: completionInput.years_experience,
      skills: completionInput.skills,
      industries: parseJsonArray(formText(formData, "industries")),
      work_experience: completionInput.work_experience,
      education: completionInput.education,
      job_titles_seeking: completionInput.job_titles_seeking,
      remote_preference: completionInput.remote_preference,
      preferred_locations: splitCommaList(
        formText(formData, "preferred_locations"),
      ),
      salary_expectation: formText(formData, "salary_expectation"),
      linkedin_url: formText(formData, "linkedin_url"),
      portfolio_url: formText(formData, "portfolio_url"),
      work_authorization: completionInput.work_authorization,
      is_complete: completion.isComplete,
      updated_at: new Date().toISOString(),
    };

    if (existing === null) {
      const { error } = await auth.insforge.database
        .from("profiles")
        .insert([payload]);
      if (error) {
        console.error("[actions/profile] insert", error);
        return { success: false, error: SAVE_ERROR };
      }
    } else {
      const { error } = await auth.insforge.database
        .from("profiles")
        .update(payload)
        .eq("id", auth.userId);
      if (error) {
        console.error("[actions/profile] update", error);
        return { success: false, error: SAVE_ERROR };
      }
    }

    revalidatePath("/profile");
    return {
      success: true,
      completedNow: !existing?.is_complete && completion.isComplete,
    };
  } catch (error) {
    console.error("[actions/profile] saveProfile", error);
    return { success: false, error: SAVE_ERROR };
  }
}

export async function uploadResume(
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const auth = await getAuthedClient();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }

    const fileValue = formData.get("resume");
    if (!(fileValue instanceof File)) {
      return { success: false, error: "Choose a PDF resume to upload." };
    }

    if (fileValue.type !== "application/pdf") {
      return { success: false, error: "Resume must be a PDF." };
    }

    if (fileValue.size > MAX_RESUME_BYTES) {
      return { success: false, error: "Resume must be 5MB or smaller." };
    }

    const objectPath = `${auth.userId}/resume.pdf`;
    const { data: uploaded, error: uploadError } = await auth.insforge.storage
      .from("resumes")
      .upload(objectPath, fileValue);

    if (uploadError || !uploaded) {
      console.error("[actions/profile] upload", uploadError);
      return { success: false, error: UPLOAD_ERROR };
    }

    if (!keyBelongsToUser(uploaded.key, auth.userId)) {
      console.error("[actions/profile] upload key prefix mismatch", uploaded.key);
      await auth.insforge.storage.from("resumes").remove(uploaded.key);
      return { success: false, error: UPLOAD_ERROR };
    }

    const existing = await loadProfileRow(auth.insforge, auth.userId);
    const previousKey = existing?.resume_pdf_key ?? null;

    const resumeFields = {
      resume_pdf_url: uploaded.url,
      resume_pdf_key: uploaded.key,
      updated_at: new Date().toISOString(),
    };

    if (existing === null) {
      const { error } = await auth.insforge.database.from("profiles").insert([
        {
          id: auth.userId,
          email: auth.email,
          is_complete: false,
          ...resumeFields,
        },
      ]);
      if (error) {
        console.error("[actions/profile] resume insert", error);
        return { success: false, error: UPLOAD_ERROR };
      }
    } else {
      const { error } = await auth.insforge.database
        .from("profiles")
        .update(resumeFields)
        .eq("id", auth.userId);
      if (error) {
        console.error("[actions/profile] resume update", error);
        return { success: false, error: UPLOAD_ERROR };
      }
    }

    if (previousKey !== null && previousKey !== uploaded.key) {
      const { error: removeError } = await auth.insforge.storage
        .from("resumes")
        .remove(previousKey);
      if (removeError) {
        console.error("[actions/profile] remove previous resume", removeError);
      }
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("[actions/profile] uploadResume", error);
    return { success: false, error: UPLOAD_ERROR };
  }
}
