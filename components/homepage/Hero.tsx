import Image from "next/image";
import { CTAButtons } from "@/components/homepage/CTAButtons";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-surface pt-16 pb-12">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-accent-light/50 blur-3xl" />
        <div className="absolute -top-12 right-1/4 h-96 w-96 rounded-full bg-info-light/50 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold text-text-black leading-tight tracking-tight mb-6">
            Job hunting is hard.
            <br />
            Your tools shouldn&apos;t be.
          </h1>
          <p className="text-base md:text-lg text-text-secondary leading-relaxed mb-10 max-w-2xl mx-auto">
            Stop applying blind. JobPilot finds the jobs, researches the companies,
            and gives you everything you need to stand out.
          </p>
          <CTAButtons />
        </div>

        <div className="mt-16 flex justify-center">
          <Image
            src="/images/dashboard-demo.png"
            alt="JobPilot dashboard preview"
            width={1100}
            height={680}
            priority
            className="w-full max-w-5xl rounded-2xl shadow-lg border border-border"
          />
        </div>
      </div>
    </section>
  );
}
