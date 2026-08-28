import { CircleAlert } from "lucide-react";
import { createInsforgeServer } from "@/lib/insforge-server";
import { parseProfileRow } from "@/lib/parse-profile";
import { getProfileCompletion } from "@/lib/profile-completion";
import { CompletionIndicator } from "@/components/profile/CompletionIndicator";
import { ProfileForm } from "@/components/profile/ProfileForm";
import type { Profile } from "@/types";

const EMPTY_COMPLETION_INPUT: Pick<
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
> = {
  full_name: null,
  phone: null,
  location: null,
  work_authorization: null,
  current_title: null,
  experience_level: null,
  years_experience: null,
  skills: [],
  work_experience: null,
  education: null,
  job_titles_seeking: [],
  remote_preference: null,
};

export default async function ProfilePage() {
  const insforge = await createInsforgeServer();
  const { data } = await insforge.auth.getCurrentUser();
  const user = data?.user;
  const email = user?.email ?? "";
  const userId = user?.id ?? "";

  let profile: Profile | null = null;
  if (user?.id) {
    const { data: rows, error } = await insforge.database
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .limit(1);
    if (error) {
      console.error("[profile/page] load", error);
    } else if (Array.isArray(rows) && rows.length > 0) {
      profile = parseProfileRow(rows[0]);
    }
  }

  const completion = getProfileCompletion(profile ?? EMPTY_COMPLETION_INPUT);
  const showBanner = completion.missingFields.length > 0;

  return (
    <div className="mx-auto max-w-[1440px] px-8 py-8">
      <h1 className="sr-only">Profile</h1>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {showBanner ? (
          <section className="bg-surface border border-border rounded-2xl p-6 shadow-card flex items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <CircleAlert className="h-4 w-4 text-error" aria-hidden="true" />
                <h2 className="text-base font-semibold text-text-primary">
                  Profile needs attention
                </h2>
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                Complete the missing fields to improve your chance of getting
                tailored matches and generating quality resumes.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {completion.missingFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full bg-error/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-error"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
            <CompletionIndicator percentage={completion.percentage} />
          </section>
        ) : null}

        <ProfileForm
          email={email}
          userId={userId}
          profile={profile}
          hasResume={Boolean(
            profile?.resume_pdf_key ?? profile?.resume_pdf_url,
          )}
        />
      </div>
    </div>
  );
}
