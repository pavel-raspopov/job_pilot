import Image from "next/image";
import { CTAButtons } from "@/components/homepage/CTAButtons";

export function HowItWorks() {
  return (
    <>
      <section className="py-24 bg-surface">
        <div className="max-w-3xl mx-auto px-8 text-center">
          <p className="text-xs font-semibold tracking-widest text-accent uppercase mb-10">
            Success Stories
          </p>
          <blockquote className="text-2xl md:text-3xl lg:text-[32px] font-medium text-text-black leading-snug mb-10">
            &ldquo;I used to spend my evenings copy-pasting resumes. Now I open
            my dashboard to see interviews waiting. It feels like cheating.
            Had 3 offers on the table simultaneously.&rdquo;
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <Image
              src="/images/user-icon.png"
              alt="Tom Wilson"
              width={40}
              height={40}
              className="rounded-full"
            />
            <div className="text-left">
              <p className="text-sm font-semibold text-text-primary">
                Tom Wilson
              </p>
              <p className="text-sm text-text-secondary">Junior Developer</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-surface">
          <div className="absolute inset-0 bg-gradient-to-r from-accent-light/30 via-surface to-info-light/30" />
          <div className="absolute top-1/2 left-1/4 h-64 w-64 -translate-y-1/2 rounded-full bg-accent-light/40 blur-3xl" />
          <div className="absolute top-1/2 right-1/4 h-64 w-64 -translate-y-1/2 rounded-full bg-info-light/40 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-text-black leading-tight mb-6">
            Your next job search can feel a lot less overwhelming
          </h2>
          <p className="text-base md:text-lg text-text-secondary leading-relaxed mb-10">
            Set up your profile, upload your resume, and start finding matches
            in minutes.
          </p>
          <CTAButtons />
        </div>
      </section>
    </>
  );
}
