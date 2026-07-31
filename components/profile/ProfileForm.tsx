"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ChevronDown, Plus, X } from "lucide-react";

type WorkExperienceEntry = {
  company: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  responsibilities: string;
};

type Props = {
  email: string;
};

const MAX_ROLES = 3;

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent disabled:bg-surface-secondary disabled:text-text-muted disabled:cursor-not-allowed";

const LABEL_CLASS =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-secondary";

const SECONDARY_BUTTON_CLASS =
  "rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-1 focus:ring-accent";

function SelectField({
  id,
  label,
  defaultValue,
  options,
}: {
  id: string;
  label: string;
  defaultValue: string;
  options: string[];
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          defaultValue={defaultValue}
          className={`${INPUT_CLASS} cursor-pointer appearance-none pr-9`}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
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

export function ProfileForm({ email }: Props) {
  const [skills, setSkills] = useState<string[]>([
    "React",
    "TypeScript",
    "Next.js",
    "Tailwind CSS",
  ]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [roles, setRoles] = useState<WorkExperienceEntry[]>([
    {
      company: "Vercel",
      jobTitle: "Frontend Engineer",
      startDate: "2022-01",
      endDate: "",
      currentlyWorking: true,
      responsibilities:
        "Built Next.js features and optimized web vitals. Led a team of 3 developers.",
    },
  ]);

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
      setRoles([
        ...roles,
        {
          company: "",
          jobTitle: "",
          startDate: "",
          endDate: "",
          currentlyWorking: false,
          responsibilities: "",
        },
      ]);
    }
  };

  const updateRole = (
    index: number,
    patch: Partial<WorkExperienceEntry>,
  ): void => {
    setRoles(
      roles.map((role, i) => (i === index ? { ...role, ...patch } : role)),
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    // Feature 05 is mock UI only — save logic arrives with Feature 06.
    event.preventDefault();
  };

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-card">
      <form onSubmit={handleSubmit}>
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
                  type="text"
                  defaultValue="Faizan Ali"
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
                  type="tel"
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
                  type="text"
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
                  type="url"
                  defaultValue="https://linkedin.com/in/faizan"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="portfolio-url" className={LABEL_CLASS}>
                  Portfolio / GitHub
                </label>
                <input
                  id="portfolio-url"
                  type="url"
                  defaultValue="https://github.com/jenastery"
                  className={INPUT_CLASS}
                />
              </div>
              <SelectField
                id="work-authorization"
                label="Work Authorization"
                defaultValue="Citizen"
                options={["Citizen", "Permanent Resident", "Visa Required"]}
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
                  type="text"
                  defaultValue="Frontend Engineer"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  id="experience-level"
                  label="Experience Level"
                  defaultValue="Junior"
                  options={["Junior", "Mid", "Senior", "Lead"]}
                />
                <div>
                  <label htmlFor="years-experience" className={LABEL_CLASS}>
                    Years of Experience
                  </label>
                  <input
                    id="years-experience"
                    type="number"
                    min={0}
                    defaultValue={4}
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
                label="Highest Degree"
                defaultValue="High School"
                options={[
                  "High School",
                  "Associate",
                  "Bachelor's",
                  "Master's",
                  "PhD",
                ]}
              />
              <div>
                <label htmlFor="field-of-study" className={LABEL_CLASS}>
                  Field of Study
                </label>
                <input
                  id="field-of-study"
                  type="text"
                  defaultValue="Computer Science"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="institution" className={LABEL_CLASS}>
                  Institution Name
                </label>
                <input
                  id="institution"
                  type="text"
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
                  type="text"
                  inputMode="numeric"
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
                  type="text"
                  defaultValue="Frontend Engineer, React Developer"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  id="remote-preference"
                  label="Remote Preference"
                  defaultValue="Any"
                  options={["Any", "Remote", "Hybrid", "Onsite"]}
                />
                <div>
                  <label htmlFor="salary-expectation" className={LABEL_CLASS}>
                    Salary Expectation (Optional)
                  </label>
                  <input
                    id="salary-expectation"
                    type="text"
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
                  type="text"
                  placeholder="E.g. New York, London"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </fieldset>
        </div>

        <div className="border-t border-border pt-6">
          <button
            type="submit"
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-accent"
          >
            Save Profile
          </button>
        </div>
      </form>
    </section>
  );
}
