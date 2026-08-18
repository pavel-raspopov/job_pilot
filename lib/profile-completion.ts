import type {
  Education,
  EducationDegree,
  ExperienceLevel,
  Profile,
  RemotePreference,
  WorkAuthorization,
  WorkExperienceRole,
} from "@/types";

export type ProfileCompletion = {
  isComplete: boolean;
  percentage: number;
  missingFields: string[];
};

const WORK_AUTHORIZATION_VALUES: readonly WorkAuthorization[] = [
  "citizen",
  "permanent_resident",
  "visa_required",
];

const EXPERIENCE_LEVEL_VALUES: readonly ExperienceLevel[] = [
  "junior",
  "mid",
  "senior",
  "lead",
];

const REMOTE_PREFERENCE_VALUES: readonly RemotePreference[] = [
  "remote",
  "onsite",
  "hybrid",
  "any",
];

const EDUCATION_DEGREE_VALUES: readonly EducationDegree[] = [
  "high_school",
  "associate",
  "bachelors",
  "masters",
  "phd",
];

const REQUIRED_SLOT_COUNT = 12;

function filledText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isWorkRoleComplete(role: WorkExperienceRole): boolean {
  const hasEnd = role.currently_working || filledText(role.end_date);
  return (
    filledText(role.company) &&
    filledText(role.job_title) &&
    filledText(role.start_date) &&
    filledText(role.responsibilities) &&
    hasEnd
  );
}

function isEducationComplete(education: Education | null): boolean {
  if (education === null || education.degree === null) {
    return false;
  }
  return (
    EDUCATION_DEGREE_VALUES.includes(education.degree) &&
    filledText(education.field) &&
    filledText(education.institution) &&
    filledText(education.year)
  );
}

export function getProfileCompletion(
  profile: Pick<
    Profile,
    | "full_name"
    | "phone"
    | "location"
    | "work_authorization"
    | "current_title"
    | "experience_level"
    | "years_experience"
    | "skills"
    | "work_experience"
    | "education"
    | "job_titles_seeking"
    | "remote_preference"
  >,
): ProfileCompletion {
  const missingFields: string[] = [];

  if (!filledText(profile.full_name)) {
    missingFields.push("Full Name");
  }
  if (!filledText(profile.phone)) {
    missingFields.push("Phone");
  }
  if (!filledText(profile.location)) {
    missingFields.push("Location");
  }
  if (
    profile.work_authorization === null ||
    !WORK_AUTHORIZATION_VALUES.includes(profile.work_authorization)
  ) {
    missingFields.push("Work Authorization");
  }
  if (!filledText(profile.current_title)) {
    missingFields.push("Job Title");
  }
  if (
    profile.experience_level === null ||
    !EXPERIENCE_LEVEL_VALUES.includes(profile.experience_level)
  ) {
    missingFields.push("Experience Level");
  }
  if (
    profile.years_experience === null ||
    !Number.isFinite(profile.years_experience)
  ) {
    missingFields.push("Years of Experience");
  }
  if (profile.skills.length === 0) {
    missingFields.push("Skills");
  }

  const roles = profile.work_experience ?? [];
  if (!roles.some(isWorkRoleComplete)) {
    missingFields.push("Work Experience");
  }

  if (!isEducationComplete(profile.education)) {
    missingFields.push("Education");
  }

  if (profile.job_titles_seeking.length === 0) {
    missingFields.push("Job Titles Seeking");
  }
  if (
    profile.remote_preference === null ||
    !REMOTE_PREFERENCE_VALUES.includes(profile.remote_preference)
  ) {
    missingFields.push("Remote Preference");
  }

  const filledCount = REQUIRED_SLOT_COUNT - missingFields.length;
  const percentage = Math.round((100 * filledCount) / REQUIRED_SLOT_COUNT);

  return {
    isComplete: missingFields.length === 0,
    percentage,
    missingFields,
  };
}

const WORK_AUTHORIZATION_SET: ReadonlySet<string> = new Set(
  WORK_AUTHORIZATION_VALUES,
);
const EXPERIENCE_LEVEL_SET: ReadonlySet<string> = new Set(
  EXPERIENCE_LEVEL_VALUES,
);
const REMOTE_PREFERENCE_SET: ReadonlySet<string> = new Set(
  REMOTE_PREFERENCE_VALUES,
);
const EDUCATION_DEGREE_SET: ReadonlySet<string> = new Set(
  EDUCATION_DEGREE_VALUES,
);

export function isWorkAuthorization(
  value: string,
): value is WorkAuthorization {
  return WORK_AUTHORIZATION_SET.has(value);
}

export function isExperienceLevel(value: string): value is ExperienceLevel {
  return EXPERIENCE_LEVEL_SET.has(value);
}

export function isRemotePreference(value: string): value is RemotePreference {
  return REMOTE_PREFERENCE_SET.has(value);
}

export function isEducationDegree(value: string): value is EducationDegree {
  return EDUCATION_DEGREE_SET.has(value);
}

export function stripBlankRoles(
  roles: WorkExperienceRole[],
): WorkExperienceRole[] {
  return roles.filter((role) => {
    return (
      filledText(role.company) ||
      filledText(role.job_title) ||
      filledText(role.start_date) ||
      filledText(role.end_date) ||
      filledText(role.responsibilities) ||
      role.currently_working
    );
  }).slice(0, 3);
}
