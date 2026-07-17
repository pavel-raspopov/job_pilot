import Image from "next/image";

type FeatureItem = {
  title: string;
  description: string;
  active?: boolean;
};

const manageFeatures: FeatureItem[] = [
  {
    title: "Find jobs that actually fit",
    description:
      "Search by title and location or paste a job link. Get matched roles you can quickly scan.",
    active: true,
  },
  {
    title: "Know the Company Before You Apply",
    description:
      "Stop guessing what a company is about. JobPilot browses their site and gives you everything you need to apply with confidence.",
  },
  {
    title: "Keep track of every application",
    description:
      "Keep a clear view of every job you've found, tailored. Your activity and progress all stay in one simple place.",
  },
];

const confidenceFeatures: FeatureItem[] = [
  {
    title: "Understand your match score",
    description:
      "See how your profile lines up with each role before you apply. Get a clear breakdown of what fits and what's missing.",
    active: true,
  },
  {
    title: "AI-Powered Job Matching",
    description:
      "Stop guessing which jobs are worth applying to. JobPilot scores every role against your actual skills so you focus on the ones that matter.",
  },
  {
    title: "Focus on the right roles",
    description:
      "Filter out low fit jobs and stay on the ones that actually matter. Spend less time sorting and more time applying.",
  },
];

function FeatureList({ items }: { items: FeatureItem[] }) {
  return (
    <ul className="space-y-8">
      {items.map((item) => (
        <li
          key={item.title}
          className={`pl-5 border-l-2 ${
            item.active ? "border-accent" : "border-transparent"
          }`}
        >
          <h3 className="text-base font-semibold text-text-primary mb-2">
            {item.title}
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {item.description}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function Features() {
  return (
    <div className="bg-surface">
      <section className="py-24">
        <div className="max-w-[1440px] mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-text-black leading-tight mb-12">
              Manage Your Job Search With Ease
            </h2>
            <FeatureList items={manageFeatures} />
          </div>
          <div className="flex justify-center lg:justify-end">
            <Image
              src="/images/jobs-lists.png"
              alt="Job match table showing companies and match scores"
              width={560}
              height={480}
              className="w-full max-w-lg rounded-2xl shadow-md border border-border"
            />
          </div>
        </div>
      </section>

      <section className="py-24 bg-background">
        <div className="max-w-[1440px] mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1 flex justify-center lg:justify-start">
            <Image
              src="/images/agnet-log.png"
              alt="JobPilot agent log showing automated job search activity"
              width={560}
              height={320}
              className="w-full max-w-lg rounded-2xl shadow-md border border-border"
            />
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl md:text-4xl font-bold text-text-black leading-tight mb-12">
              Apply With More Confidence, Every Time
            </h2>
            <FeatureList items={confidenceFeatures} />
          </div>
        </div>
      </section>
    </div>
  );
}
