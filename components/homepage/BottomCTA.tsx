import { CTAButtons } from "@/components/homepage/CTAButtons";

export function BottomCTA() {
  return (
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
          Set up your profile, upload your resume, and start finding matches in
          minutes.
        </p>
        <CTAButtons />
      </div>
    </section>
  );
}
