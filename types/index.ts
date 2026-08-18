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
  resume_pdf_url: string | null;
  resume_pdf_key: string | null;
  is_complete: boolean;
};
