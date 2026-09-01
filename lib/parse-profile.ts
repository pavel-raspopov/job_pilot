import type {
  Education,
  ExperienceLevel,
  Profile,
  RemotePreference,
  WorkAuthorization,
  WorkExperienceRole,
} from "@/types";
import {
  isEducationDegree,
  isExperienceLevel,
  isRemotePreference,
  isWorkAuthorization,
} from "@/lib/profile-completion";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function parseWorkRole(value: unknown): WorkExperienceRole | null {
  if (!isRecord(value)) {
    return null;
  }
  const currentlyWorking = value.currently_working === true;
  const endDate = asNullableString(value.end_date);
  return {
    company: asNullableString(value.company) ?? "",
    job_title: asNullableString(value.job_title) ?? "",
    start_date: asNullableString(value.start_date) ?? "",
    end_date: currentlyWorking ? null : endDate,
    currently_working: currentlyWorking,
    responsibilities: asNullableString(value.responsibilities) ?? "",
  };
}

function parseEducation(value: unknown): Education | null {
  if (!isRecord(value)) {
    return null;
  }
  const degreeRaw = asNullableString(value.degree);
  const degree =
    degreeRaw !== null && isEducationDegree(degreeRaw) ? degreeRaw : null;
  const field = asNullableString(value.field) ?? "";
  const institution = asNullableString(value.institution) ?? "";
  const year = asNullableString(value.year) ?? "";
  if (degree === null && field.length === 0 && institution.length === 0 && year.length === 0) {
    return null;
  }
  return { degree, field, institution, year };
}

function parseExperienceLevel(value: unknown): ExperienceLevel | null {
  const raw = asNullableString(value);
  if (raw === null || !isExperienceLevel(raw)) {
    return null;
  }
  return raw;
}

function parseWorkAuthorization(value: unknown): WorkAuthorization | null {
  const raw = asNullableString(value);
  if (raw === null || !isWorkAuthorization(raw)) {
    return null;
  }
  return raw;
}

function parseRemotePreference(value: unknown): RemotePreference | null {
  const raw = asNullableString(value);
  if (raw === null || !isRemotePreference(raw)) {
    return null;
  }
  return raw;
}

export function parseProfileRow(row: unknown): Profile | null {
  if (!isRecord(row) || typeof row.id !== "string") {
    return null;
  }

  const yearsRaw = row.years_experience;
  const yearsExperience =
    typeof yearsRaw === "number" && Number.isFinite(yearsRaw)
      ? yearsRaw
      : null;

  const rolesRaw = row.work_experience;
  const workExperience = Array.isArray(rolesRaw)
    ? rolesRaw
        .map(parseWorkRole)
        .filter((role): role is WorkExperienceRole => role !== null)
    : null;

  return {
    id: row.id,
    full_name: asNullableString(row.full_name),
    email: asNullableString(row.email),
    phone: asNullableString(row.phone),
    location: asNullableString(row.location),
    current_title: asNullableString(row.current_title),
    experience_level: parseExperienceLevel(row.experience_level),
    years_experience: yearsExperience,
    skills: asStringArray(row.skills),
    industries: asStringArray(row.industries),
    work_experience: workExperience,
    education: parseEducation(row.education),
    job_titles_seeking: asStringArray(row.job_titles_seeking),
    remote_preference: parseRemotePreference(row.remote_preference),
    preferred_locations: asStringArray(row.preferred_locations),
    salary_expectation: asNullableString(row.salary_expectation),
    linkedin_url: asNullableString(row.linkedin_url),
    portfolio_url: asNullableString(row.portfolio_url),
    work_authorization: parseWorkAuthorization(row.work_authorization),
    resume_pdf_url: asNullableString(row.resume_pdf_url),
    resume_pdf_key: asNullableString(row.resume_pdf_key),
    generated_resume_url: asNullableString(row.generated_resume_url),
    generated_resume_key: asNullableString(row.generated_resume_key),
    is_complete: row.is_complete === true,
  };
}
