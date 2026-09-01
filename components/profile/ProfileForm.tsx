"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import posthog from "posthog-js";
import { saveProfile } from "@/actions/profile";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import {
  isEducationDegree,
  isExperienceLevel,
  isRemotePreference,
  isWorkAuthorization,
} from "@/lib/profile-completion";
import type {
  Education,
  ExtractedEducation,
  ExtractedProfile,
  Profile,
  WorkExperienceRole,
} from "@/types";

type FormRole = {
  company: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  responsibilities: string;
};

type Props = {
  email: string;
  userId: string;
  profile: Profile | null;
  hasResume: boolean;
  hasGeneratedResume: boolean;
  isProfileComplete: boolean;
};

/**
 * Fields the form renders from `draft`. Extraction merges over this shape;
 * the stored `profile` seeds it and is never mutated.
 */
type Draft = Partial<
  Pick<
    Profile,
    | "full_name"
    | "phone"
    | "location"
    | "linkedin_url"
    | "portfolio_url"
    | "work_authorization"
    | "current_title"
    | "experience_level"
    | "years_experience"
    | "education"
    | "job_titles_seeking"
    | "remote_preference"
    | "preferred_locations"
    | "salary_expectation"
  >
>;

function draftFromProfile(profile: Profile | null): Draft {
  if (profile === null) {
    return {};
  }
  return {
    full_name: profile.full_name,
    phone: profile.phone,
    location: profile.location,
    linkedin_url: profile.linkedin_url,
    portfolio_url: profile.portfolio_url,
    work_authorization: profile.work_authorization,
    current_title: profile.current_title,
    experience_level: profile.experience_level,
    years_experience: profile.years_experience,
    education: profile.education,
    job_titles_seeking: profile.job_titles_seeking,
    remote_preference: profile.remote_preference,
    preferred_locations: profile.preferred_locations,
    salary_expectation: profile.salary_expectation,
  };
}

/**
 * Reads one trimmed value out of a submitted form, mirroring `formText` in
 * `actions/profile.ts` so a round trip through the form cannot change meaning.
 */
function formText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formEnum<T extends string>(
  formData: FormData,
  key: string,
  guard: (candidate: string) => candidate is T,
): T | null {
  const value = formText(formData, key);
  return value !== null && guard(value) ? value : null;
}

function formList(formData: FormData, key: string): string[] {
  const value = formText(formData, key);
  if (value === null) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * The form as it stands on screen, read back into a `Draft`.
 *
 * The mapping deliberately matches what `saveProfile` does with the same field
 * names, so reading the form and re-seeding it is lossless.
 */
function draftFromForm(form: HTMLFormElement): Draft {
  const formData = new FormData(form);

  const degree = formEnum(formData, "education_degree", isEducationDegree);
  const field = formText(formData, "education_field");
  const institution = formText(formData, "education_institution");
  const year = formText(formData, "education_year");

  const yearsRaw = formText(formData, "years_experience");
  const years = yearsRaw === null ? null : Number(yearsRaw);

  return {
    full_name: formText(formData, "full_name"),
    phone: formText(formData, "phone"),
    location: formText(formData, "location"),
    linkedin_url: formText(formData, "linkedin_url"),
    portfolio_url: formText(formData, "portfolio_url"),
    work_authorization: formEnum(
      formData,
      "work_authorization",
      isWorkAuthorization,
    ),
    current_title: formText(formData, "current_title"),
    experience_level: formEnum(
      formData,
      "experience_level",
      isExperienceLevel,
    ),
    years_experience: years !== null && Number.isFinite(years) ? years : null,
    education:
      degree === null && field === null && institution === null && year === null
        ? null
        : {
            degree,
            field: field ?? "",
            institution: institution ?? "",
            year: year ?? "",
          },
    job_titles_seeking: formList(formData, "job_titles_seeking"),
    remote_preference: formEnum(
      formData,
      "remote_preference",
      isRemotePreference,
    ),
    preferred_locations: formList(formData, "preferred_locations"),
    salary_expectation: formText(formData, "salary_expectation"),
  };
}

/**
 * Education, merged one sub-field at a time.
 *
 * `ExtractedEducation` omits what the resume does not state, so an absent key
 * means "keep what the user has". Replacing the whole object instead meant a
 * resume naming only an institution cleared a degree, field and graduation year
 * the user had already filled in — quietly turning a complete profile
 * incomplete, with nothing on screen to say a value had been dropped.
 */
function mergeEducation(
  existing: Education | null | undefined,
  extracted: ExtractedEducation | undefined,
): Education | null {
  if (extracted === undefined) {
    return existing ?? null;
  }

  const base: Education =
    existing ?? { degree: null, field: "", institution: "", year: "" };

  return {
    degree: extracted.degree ?? base.degree,
    field: extracted.field ?? base.field,
    institution: extracted.institution ?? base.institution,
    year: extracted.year ?? base.year,
  };
}

function rolesFromExtracted(roles: WorkExperienceRole[]): FormRole[] {
  return roles.slice(0, MAX_ROLES).map((role) => ({
    company: role.company,
    jobTitle: role.job_title,
    startDate: role.start_date,
    endDate: role.end_date ?? "",
    currentlyWorking: role.currently_working,
    responsibilities: role.responsibilities,
  }));
}

const MAX_ROLES = 3;

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent disabled:bg-surface-secondary disabled:text-text-muted disabled:cursor-not-allowed";

const LABEL_CLASS =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-secondary";

const SECONDARY_BUTTON_CLASS =
  "rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-1 focus:ring-accent";

const WORK_AUTHORIZATION_OPTIONS = [
  { value: "citizen", label: "Citizen" },
  { value: "permanent_resident", label: "Permanent Resident" },
  { value: "visa_required", label: "Visa Required" },
];

const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
];

const REMOTE_PREFERENCE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
];

const DEGREE_OPTIONS = [
  { value: "high_school", label: "High School" },
  { value: "associate", label: "Associate" },
  { value: "bachelors", label: "Bachelor's" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD" },
];

function emptyRole(): FormRole {
  return {
    company: "",
    jobTitle: "",
    startDate: "",
    endDate: "",
    currentlyWorking: false,
    responsibilities: "",
  };
}

function rolesFromProfile(profile: Profile | null): FormRole[] {
  const stored = profile?.work_experience ?? [];
  if (stored.length === 0) {
    return [emptyRole()];
  }
  return stored.map((role) => ({
    company: role.company,
    jobTitle: role.job_title,
    startDate: role.start_date,
    endDate: role.end_date ?? "",
    currentlyWorking: role.currently_working,
    responsibilities: role.responsibilities,
  }));
}

function SelectField({
  id,
  name,
  label,
  defaultValue,
  options,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={name}
          defaultValue={defaultValue}
          className={`${INPUT_CLASS} cursor-pointer appearance-none pr-9`}
        >
          <option value="">Select…</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function TagInput({
  id,
  label,
  placeholder,
  tags,
  onAdd,
  onRemove,
}: {
  id: string;
  label: string;
  placeholder: string;
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [value, setValue] = useState("");

  const add = (): void => {
    const tag = value.trim();
    if (tag.length > 0) {
      onAdd(tag);
      setValue("");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  };

  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          className={INPUT_CLASS}
        />
        <button type="button" onClick={add} className={SECONDARY_BUTTON_CLASS}>
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-text-dark"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                aria-label={`Remove ${tag}`}
                className="text-text-muted transition-colors hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-accent rounded-full"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProfileForm({
  email,
  userId,
  profile,
  hasResume,
  hasGeneratedResume,
  isProfileComplete,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFromProfile(profile));
  const [formKey, setFormKey] = useState(0);
  const [skills, setSkills] = useState<string[]>(profile?.skills ?? []);
  const [industries, setIndustries] = useState<string[]>(
    profile?.industries ?? [],
  );
  const [roles, setRoles] = useState<FormRole[]>(() =>
    rolesFromProfile(profile),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * The live `<form>`, so extraction can read back what the user has typed
   * before the remount throws those DOM nodes away.
   */
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Synchronous in-flight guard, same reason as `generatingRef` in
   * `ResumeUpload`: `setSaving(true)` does not take effect until React
   * re-renders, so two clicks landing in the same tick both read
   * `saving === false` and both submit. On a first-ever save that means two
   * concurrent inserts of the same primary key — one wins, the other comes back
   * as a conflict, and the user is told the save failed on a save that
   * succeeded. The `disabled` attribute alone cannot close that window.
   */
  const savingRef = useRef(false);

  /**
   * Merge extracted values over what is currently on screen, then remount the
   * form so the uncontrolled `defaultValue` inputs re-read it. Fields the
   * resume did not state keep the value they had.
   */
  const handleExtracted = (extracted: ExtractedProfile): void => {
    setDraft((storedDraft) => {
      // Seed from the live form, not from the stored draft. The named inputs
      // below are uncontrolled, so a value the user typed and has not saved
      // exists only in the DOM — and bumping `formKey` destroys those nodes and
      // re-seeds them from `draft`. Reading the form back first is what makes
      // "fields the resume does not state are left as they were" true for typed
      // input: without it, extracting a resume that states no phone number
      // silently discarded a phone number the user had just entered, and the
      // same went for all seventeen named fields.
      const base =
        formRef.current === null ? storedDraft : draftFromForm(formRef.current);

      return {
        ...base,
        ...(extracted.full_name !== undefined && {
          full_name: extracted.full_name,
        }),
        ...(extracted.phone !== undefined && { phone: extracted.phone }),
        ...(extracted.location !== undefined && {
          location: extracted.location,
        }),
        ...(extracted.linkedin_url !== undefined && {
          linkedin_url: extracted.linkedin_url,
        }),
        ...(extracted.portfolio_url !== undefined && {
          portfolio_url: extracted.portfolio_url,
        }),
        ...(extracted.work_authorization !== undefined && {
          work_authorization: extracted.work_authorization,
        }),
        ...(extracted.current_title !== undefined && {
          current_title: extracted.current_title,
        }),
        ...(extracted.experience_level !== undefined && {
          experience_level: extracted.experience_level,
        }),
        ...(extracted.years_experience !== undefined && {
          years_experience: extracted.years_experience,
        }),
        education: mergeEducation(base.education, extracted.education),
        ...(extracted.job_titles_seeking !== undefined && {
          job_titles_seeking: extracted.job_titles_seeking,
        }),
        ...(extracted.remote_preference !== undefined && {
          remote_preference: extracted.remote_preference,
        }),
        ...(extracted.preferred_locations !== undefined && {
          preferred_locations: extracted.preferred_locations,
        }),
        ...(extracted.salary_expectation !== undefined && {
          salary_expectation: extracted.salary_expectation,
        }),
      };
    });

    if (extracted.skills !== undefined) {
      setSkills(extracted.skills);
    }
    if (extracted.industries !== undefined) {
      setIndustries(extracted.industries);
    }
    if (extracted.work_experience !== undefined) {
      setRoles(rolesFromExtracted(extracted.work_experience));
    }

    setError(null);
    setFormKey((key) => key + 1);
  };

  const addTag = (
    list: string[],
    setList: (next: string[]) => void,
    tag: string,
  ): void => {
    if (!list.includes(tag)) {
      setList([...list, tag]);
    }
  };

  const addRole = (): void => {
    if (roles.length < MAX_ROLES) {
      setRoles([...roles, emptyRole()]);
    }
  };

  const updateRole = (index: number, patch: Partial<FormRole>): void => {
    setRoles(roles.map((role, i) => (i === index ? { ...role, ...patch } : role)));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (savingRef.current) {
      return;
    }
    savingRef.current = true;

    setError(null);
    setSaving(true);

    const formData = new FormData(event.currentTarget);
    formData.set("skills", JSON.stringify(skills));
    formData.set("industries", JSON.stringify(industries));

    const payloadRoles: WorkExperienceRole[] = roles.map((role) => ({
      company: role.company,
      job_title: role.jobTitle,
      start_date: role.startDate,
      end_date: role.currentlyWorking ? null : role.endDate,
      currently_working: role.currentlyWorking,
      responsibilities: role.responsibilities,
    }));
    formData.set("work_experience", JSON.stringify(payloadRoles));

    const result = await saveProfile(formData);
    savingRef.current = false;
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? "Failed to save profile");
      return;
    }

    if (result.completedNow) {
      posthog.capture("profile_completed", { userId });
    }
  };

  return (
    <>
      <ResumeUpload
        hasResume={hasResume}
        hasGeneratedResume={hasGeneratedResume}
        isProfileComplete={isProfileComplete}
        onExtracted={handleExtracted}
      />

      <section className="bg-surface border border-border rounded-2xl p-6 shadow-card">
      <form key={formKey} ref={formRef} onSubmit={handleSubmit}>
        <div className="border-b border-border pb-4">
          <h2 className="text-base font-semibold text-text-primary">
            Profile Information
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            This content is used to accurately represent you in agent
            interactions.
          </p>
        </div>

        <div className="divide-y divide-border">
          <fieldset className="py-6">
            <legend className="float-left mb-4 text-sm font-semibold text-text-primary">
              Personal Info
            </legend>
            <div className="clear-left grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="full-name" className={LABEL_CLASS}>
                  Full Name
                </label>
                <input
                  id="full-name"
                  name="full_name"
                  type="text"
                  defaultValue={draft?.full_name ?? ""}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="email" className={LABEL_CLASS}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  readOnly
                  className={`${INPUT_CLASS} cursor-not-allowed bg-surface-secondary text-text-secondary`}
                />
              </div>
              <div>
                <label htmlFor="phone" className={LABEL_CLASS}>
                  Phone Number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={draft?.phone ?? ""}
                  placeholder="+1 (555) 000-0000"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="location" className={LABEL_CLASS}>
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  defaultValue={draft?.location ?? ""}
                  placeholder="City, Country"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="linkedin-url" className={LABEL_CLASS}>
                  LinkedIn URL
                </label>
                <input
                  id="linkedin-url"
                  name="linkedin_url"
                  type="url"
                  defaultValue={draft?.linkedin_url ?? ""}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="portfolio-url" className={LABEL_CLASS}>
                  Portfolio / GitHub
                </label>
                <input
                  id="portfolio-url"
                  name="portfolio_url"
                  type="url"
                  defaultValue={draft?.portfolio_url ?? ""}
                  className={INPUT_CLASS}
                />
              </div>
              <SelectField
                id="work-authorization"
                name="work_authorization"
                label="Work Authorization"
                defaultValue={draft?.work_authorization ?? ""}
                options={WORK_AUTHORIZATION_OPTIONS}
              />
            </div>
          </fieldset>

          <fieldset className="py-6">
            <legend className="float-left mb-4 text-sm font-semibold text-text-primary">
              Professional Info
            </legend>
            <div className="clear-left space-y-4">
              <div>
                <label htmlFor="current-title" className={LABEL_CLASS}>
                  Current/Recent Job Title
                </label>
                <input
                  id="current-title"
                  name="current_title"
                  type="text"
                  defaultValue={draft?.current_title ?? ""}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  id="experience-level"
                  name="experience_level"
                  label="Experience Level"
                  defaultValue={draft?.experience_level ?? ""}
                  options={EXPERIENCE_LEVEL_OPTIONS}
                />
                <div>
                  <label htmlFor="years-experience" className={LABEL_CLASS}>
                    Years of Experience
                  </label>
                  <input
                    id="years-experience"
                    name="years_experience"
                    type="number"
                    min={0}
                    defaultValue={
                      draft.years_experience === null ||
                      draft.years_experience === undefined
                        ? ""
                        : draft.years_experience
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <TagInput
                id="skills"
                label="Skills"
                placeholder="Add a skill"
                tags={skills}
                onAdd={(tag) => addTag(skills, setSkills, tag)}
                onRemove={(tag) => setSkills(skills.filter((s) => s !== tag))}
              />
              <TagInput
                id="industries"
                label="Industries Worked In (Optional)"
                placeholder="E.g. FinTech, Healthcare"
                tags={industries}
                onAdd={(tag) => addTag(industries, setIndustries, tag)}
                onRemove={(tag) =>
                  setIndustries(industries.filter((i) => i !== tag))
                }
              />
            </div>
          </fieldset>

          <fieldset className="py-6">
            <legend className="float-left text-sm font-semibold text-text-primary">
              Work Experience
            </legend>
            {roles.length < MAX_ROLES && (
              <button
                type="button"
                onClick={addRole}
                className="float-right flex items-center gap-1 text-sm font-medium text-accent transition-opacity hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-accent rounded-md"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add role
              </button>
            )}
            <div className="clear-both space-y-4 pt-4">
              {roles.map((role, index) => (
                <div
                  key={index}
                  className="space-y-4 rounded-md border border-border p-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`company-${index}`}
                        className={LABEL_CLASS}
                      >
                        Company Name
                      </label>
                      <input
                        id={`company-${index}`}
                        type="text"
                        value={role.company}
                        placeholder="E.g. Vercel"
                        onChange={(event) =>
                          updateRole(index, { company: event.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`job-title-${index}`}
                        className={LABEL_CLASS}
                      >
                        Job Title
                      </label>
                      <input
                        id={`job-title-${index}`}
                        type="text"
                        value={role.jobTitle}
                        placeholder="E.g. Frontend Engineer"
                        onChange={(event) =>
                          updateRole(index, { jobTitle: event.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`start-date-${index}`}
                        className={LABEL_CLASS}
                      >
                        Start Date
                      </label>
                      <input
                        id={`start-date-${index}`}
                        type="month"
                        value={role.startDate}
                        onChange={(event) =>
                          updateRole(index, { startDate: event.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label
                          htmlFor={`end-date-${index}`}
                          className="text-xs font-medium uppercase tracking-wide text-text-secondary"
                        >
                          End Date
                        </label>
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-text-dark">
                          <input
                            type="checkbox"
                            checked={role.currentlyWorking}
                            onChange={(event) =>
                              updateRole(index, {
                                currentlyWorking: event.target.checked,
                                endDate: event.target.checked
                                  ? ""
                                  : role.endDate,
                              })
                            }
                            className="h-3.5 w-3.5 accent-accent"
                          />
                          Currently working here
                        </label>
                      </div>
                      <input
                        id={`end-date-${index}`}
                        type="month"
                        value={role.endDate}
                        disabled={role.currentlyWorking}
                        onChange={(event) =>
                          updateRole(index, { endDate: event.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor={`responsibilities-${index}`}
                      className={LABEL_CLASS}
                    >
                      Key Responsibilities
                    </label>
                    <textarea
                      id={`responsibilities-${index}`}
                      rows={3}
                      value={role.responsibilities}
                      placeholder="Describe your impact in this role"
                      onChange={(event) =>
                        updateRole(index, {
                          responsibilities: event.target.value,
                        })
                      }
                      className={`${INPUT_CLASS} resize-y`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="py-6">
            <legend className="float-left mb-4 text-sm font-semibold text-text-primary">
              Education
            </legend>
            <div className="clear-left grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                id="highest-degree"
                name="education_degree"
                label="Highest Degree"
                defaultValue={draft?.education?.degree ?? ""}
                options={DEGREE_OPTIONS}
              />
              <div>
                <label htmlFor="field-of-study" className={LABEL_CLASS}>
                  Field of Study
                </label>
                <input
                  id="field-of-study"
                  name="education_field"
                  type="text"
                  defaultValue={draft?.education?.field ?? ""}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="institution" className={LABEL_CLASS}>
                  Institution Name
                </label>
                <input
                  id="institution"
                  name="education_institution"
                  type="text"
                  defaultValue={draft?.education?.institution ?? ""}
                  placeholder="E.g. State University"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="graduation-year" className={LABEL_CLASS}>
                  Graduation Year
                </label>
                <input
                  id="graduation-year"
                  name="education_year"
                  type="text"
                  inputMode="numeric"
                  defaultValue={draft?.education?.year ?? ""}
                  placeholder="YYYY"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="py-6">
            <legend className="float-left mb-4 text-sm font-semibold text-text-primary">
              Job Preferences
            </legend>
            <div className="clear-left space-y-4">
              <div>
                <label htmlFor="job-titles-seeking" className={LABEL_CLASS}>
                  Job Titles Seeking
                </label>
                <input
                  id="job-titles-seeking"
                  name="job_titles_seeking"
                  type="text"
                  defaultValue={draft.job_titles_seeking?.join(", ") ?? ""}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  id="remote-preference"
                  name="remote_preference"
                  label="Remote Preference"
                  defaultValue={draft?.remote_preference ?? ""}
                  options={REMOTE_PREFERENCE_OPTIONS}
                />
                <div>
                  <label htmlFor="salary-expectation" className={LABEL_CLASS}>
                    Salary Expectation (Optional)
                  </label>
                  <input
                    id="salary-expectation"
                    name="salary_expectation"
                    type="text"
                    defaultValue={draft?.salary_expectation ?? ""}
                    placeholder="E.g. $120k+"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="preferred-locations" className={LABEL_CLASS}>
                  Preferred Locations (Optional)
                </label>
                <input
                  id="preferred-locations"
                  name="preferred_locations"
                  type="text"
                  defaultValue={draft.preferred_locations?.join(", ") ?? ""}
                  placeholder="E.g. New York, London"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </fieldset>
        </div>

        <div className="border-t border-border pt-6">
          {error ? (
            <p className="mb-3 text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </form>
      </section>
    </>
  );
}
