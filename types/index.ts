export type WorkAuthorization =
  | "citizen"
  | "permanent_resident"
  | "visa_required";

export type ExperienceLevel = "junior" | "mid" | "senior" | "lead";

export type RemotePreference = "remote" | "onsite" | "hybrid" | "any";

export type EducationDegree =
  | "high_school"
  | "associate"
  | "bachelors"
  | "masters"
  | "phd";

export type WorkExperienceRole = {
  company: string;
  job_title: string;
  start_date: string;
  end_date: string | null;
  currently_working: boolean;
  responsibilities: string;
};

export type Education = {
  degree: EducationDegree | null;
  field: string;
  institution: string;
  year: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  current_title: string | null;
  experience_level: ExperienceLevel | null;
  years_experience: number | null;
  skills: string[];
  industries: string[];
  work_experience: WorkExperienceRole[] | null;
  education: Education | null;
  job_titles_seeking: string[];
  remote_preference: RemotePreference | null;
  preferred_locations: string[];
  salary_expectation: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  work_authorization: WorkAuthorization | null;
  /** The resume the user UPLOADED. Feature 07's extraction reads this key. */
  resume_pdf_url: string | null;
  resume_pdf_key: string | null;
  /**
   * The resume the app GENERATED from this profile — a separate storage object
   * from the uploaded one, so generating never destroys the extraction source.
   * The `resumes` bucket is private, so the url is a record, not a fetchable
   * link; downloads go through a short-lived signed URL.
   */
  generated_resume_url: string | null;
  generated_resume_key: string | null;
  is_complete: boolean;
};

/**
 * Education as a resume states it. Sub-fields the resume does not state are
 * **absent**, not null or empty.
 *
 * That distinction is load-bearing: the form merges this over whatever the user
 * already has, so an absent `degree` means "keep theirs" while `degree: null`
 * would mean "clear theirs". Sending the full `Education` shape with null and
 * "" placeholders collapsed the two, and a resume naming only an institution
 * wiped a degree, field and year the user had already filled in.
 */
export type ExtractedEducation = {
  degree?: EducationDegree;
  field?: string;
  institution?: string;
  year?: string;
};

/**
 * Profile fields recovered from a resume PDF by `POST /api/resume/extract`.
 * Every field is optional: the resume states what it states, and anything
 * absent must be left alone rather than blanked.
 */
export type ExtractedProfile = {
  full_name?: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  work_authorization?: WorkAuthorization;
  current_title?: string;
  experience_level?: ExperienceLevel;
  years_experience?: number;
  skills?: string[];
  industries?: string[];
  job_titles_seeking?: string[];
  remote_preference?: RemotePreference;
  preferred_locations?: string[];
  salary_expectation?: string;
  education?: ExtractedEducation;
  work_experience?: WorkExperienceRole[];
};

/** Result shape of `POST /api/resume/extract`. Mirrors `ProfileActionResult`. */
export type ExtractActionResult = {
  success: boolean;
  error?: string;
  profile?: ExtractedProfile;
};

/**
 * Result shape of `POST /api/resume/generate`.
 *
 * `downloadUrl` is a **short-lived signed URL**, not the stored
 * `generated_resume_url` — the `resumes` bucket is private, so the stored value
 * is not directly fetchable. It expires within minutes; the UI must not present
 * it as a permanent link.
 */
export type GenerateActionResult = {
  success: boolean;
  error?: string;
  downloadUrl?: string;
};
