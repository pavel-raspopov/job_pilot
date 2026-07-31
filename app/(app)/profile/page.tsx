import { CircleAlert } from "lucide-react";
import { createInsforgeServer } from "@/lib/insforge-server";
import { CompletionIndicator } from "@/components/profile/CompletionIndicator";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ResumeUpload } from "@/components/profile/ResumeUpload";

const MISSING_FIELDS = ["Phone", "Location", "Education"];

export default async function ProfilePage() {
  const insforge = await createInsforgeServer();
  const { data } = await insforge.auth.getCurrentUser();
  const email = data?.user?.email ?? "";

  return (
    <div className="mx-auto max-w-[1440px] px-8 py-8">
      <h1 className="sr-only">Profile</h1>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
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
              {MISSING_FIELDS.map((field) => (
                <span
                  key={field}
                  className="rounded-full bg-error/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-error"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>
          <CompletionIndicator percentage={70} />
        </section>

        <ResumeUpload />
        <ProfileForm email={email} />
      </div>
    </div>
  );
}
