import { JobsTable } from "@/components/find-jobs/JobsTable";
import { SearchControls } from "@/components/find-jobs/SearchControls";
import { HIGH_MATCH_THRESHOLD } from "@/lib/utils";
import type { Job, JobSource } from "@/types";

/**
 * Sample jobs for Feature 09.
 *
 * Feature 10 replaces `buildMockJobs()` with a `jobs` select for the signed-in
 * user; nothing below this file changes. The data deliberately lives here, in
 * the first file Feature 10 opens, rather than in a `lib/` module that could
 * outlive its purpose by looking like infrastructure.
 *
 * Scores span all three colour bands, including two below 50, so the match-score
 * banding and the High/Low Match filters are all exercisable by hand.
 */
type MockSeed = {
  company: string;
  title: string;
  score: number;
  salary: string;
  source: JobSource;
  hoursAgo: number;
};

const HOURS_PER_DAY = 24;

const MOCK_SEED: MockSeed[] = [
  { company: "Vercel", title: "Senior Frontend Engineer", score: 94, salary: "$160k - $200k", source: "search", hoursAgo: 2 },
  { company: "Stripe", title: "Staff UI Engineer", score: 88, salary: "$180k - $240k", source: "search", hoursAgo: 26 },
  { company: "Linear", title: "Product Engineer", score: 96, salary: "$150k - $190k", source: "search", hoursAgo: 30 },
  { company: "Notion", title: "Frontend Developer", score: 72, salary: "$130k - $170k", source: "url", hoursAgo: 50 },
  { company: "OpenAI", title: "Design Engineer", score: 91, salary: "$200k - $280k", source: "search", hoursAgo: 74 },
  { company: "Figma", title: "Software Engineer, Editor", score: 85, salary: "$170k - $220k", source: "search", hoursAgo: 98 },
  { company: "Anthropic", title: "Frontend Engineer, Console", score: 93, salary: "$190k - $260k", source: "search", hoursAgo: 5 * HOURS_PER_DAY },
  { company: "Shopify", title: "Senior React Developer", score: 81, salary: "$140k - $185k", source: "search", hoursAgo: 6 * HOURS_PER_DAY },
  { company: "Airbnb", title: "Web Platform Engineer", score: 78, salary: "$165k - $215k", source: "url", hoursAgo: 7 * HOURS_PER_DAY },
  { company: "Datadog", title: "UI Engineer", score: 69, salary: "$145k - $190k", source: "search", hoursAgo: 8 * HOURS_PER_DAY },
  { company: "Cloudflare", title: "Frontend Engineer, Dashboard", score: 64, salary: "$150k - $195k", source: "search", hoursAgo: 9 * HOURS_PER_DAY },
  { company: "Netflix", title: "Senior UI Engineer", score: 87, salary: "$190k - $250k", source: "search", hoursAgo: 10 * HOURS_PER_DAY },
  { company: "Discord", title: "Product Engineer, Client", score: 76, salary: "$160k - $210k", source: "url", hoursAgo: 11 * HOURS_PER_DAY },
  { company: "Ramp", title: "Full-Stack Engineer", score: 83, salary: "$170k - $220k", source: "search", hoursAgo: 12 * HOURS_PER_DAY },
  { company: "Retool", title: "Frontend Engineer", score: 71, salary: "$150k - $200k", source: "search", hoursAgo: 13 * HOURS_PER_DAY },
  { company: "Supabase", title: "Developer Experience Engineer", score: 66, salary: "$130k - $175k", source: "search", hoursAgo: 14 * HOURS_PER_DAY },
  { company: "Sentry", title: "Frontend Engineer", score: 58, salary: "$140k - $180k", source: "url", hoursAgo: 15 * HOURS_PER_DAY },
  { company: "Grafana Labs", title: "UI Engineer", score: 62, salary: "$135k - $175k", source: "search", hoursAgo: 16 * HOURS_PER_DAY },
  { company: "Postman", title: "Senior Web Engineer", score: 55, salary: "$125k - $165k", source: "search", hoursAgo: 17 * HOURS_PER_DAY },
  { company: "Atlassian", title: "Frontend Engineer, Jira", score: 49, salary: "$130k - $170k", source: "search", hoursAgo: 18 * HOURS_PER_DAY },
  { company: "Twilio", title: "Web Developer", score: 44, salary: "$120k - $155k", source: "url", hoursAgo: 19 * HOURS_PER_DAY },
  { company: "Segment", title: "Frontend Engineer", score: 53, salary: "$135k - $175k", source: "search", hoursAgo: 20 * HOURS_PER_DAY },
  { company: "Zapier", title: "Senior Frontend Engineer", score: 79, salary: "$145k - $195k", source: "search", hoursAgo: 21 * HOURS_PER_DAY },
  { company: "Amplitude", title: "Product Engineer, Web", score: 68, salary: "$140k - $185k", source: "search", hoursAgo: 22 * HOURS_PER_DAY },
];

const MOCK_USER_ID = "00000000-0000-4000-8000-000000000000";

/**
 * Build the sample rows.
 *
 * Every `found_at` is derived from a single `now` captured here, on the server,
 * and passed down as data. The list component formats those same strings, so the
 * server render and hydration agree.
 */
function buildMockJobs(): Job[] {
  const now = Date.now();

  return MOCK_SEED.map((seed, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    run_id: null,
    user_id: MOCK_USER_ID,
    source: seed.source,
    source_url: null,
    external_apply_url: null,
    title: seed.title,
    company: seed.company,
    location: null,
    salary: seed.salary,
    job_type: null,
    about_role: null,
    responsibilities: null,
    requirements: null,
    nice_to_have: null,
    benefits: null,
    about_company: null,
    match_score: seed.score,
    match_reason: null,
    matched_skills: null,
    missing_skills: null,
    company_research: null,
    found_at: new Date(now - seed.hoursAgo * 60 * 60 * 1000).toISOString(),
  }));
}

export default function FindJobsPage() {
  const jobs = buildMockJobs();

  // The design's banner reads "Found 8 jobs and saved 4 strong matches" — copy
  // written against an 8-row mock. Derived here instead so the summary cannot
  // contradict the rows on screen. Feature 10 reports the real run's counts.
  const strongMatches = jobs.filter(
    (job) => (job.match_score ?? 0) >= HIGH_MATCH_THRESHOLD,
  ).length;

  return (
    <div className="mx-auto max-w-[1440px] px-8 py-8">
      <h1 className="sr-only">Find Jobs</h1>
      <div className="flex flex-col gap-6">
        <SearchControls
          jobsFound={jobs.length}
          strongMatches={strongMatches}
        />
        <JobsTable jobs={jobs} />
      </div>
    </div>
  );
}
