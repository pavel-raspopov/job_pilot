import { z } from 'zod';

/**
 * Centralised, boot-time-validated environment variables.
 *
 * Every required env var is declared here once, validated with zod, and
 * exported as a typed constant. Import `env` instead of reaching for
 * `process.env.X!` — a missing or malformed value fails loudly here at module
 * load with a readable message, rather than crashing deep inside an SDK.
 *
 * Only truly-required vars belong in this schema. Optional integrations that
 * degrade gracefully when unset (e.g. the PostHog token) are read directly
 * where they are used and must NOT be added here. Later features extend this
 * schema when they introduce their own required vars.
 *
 * Note: each var is referenced by its full static name so Next.js can inline
 * `NEXT_PUBLIC_*` values into the client bundle at build time.
 */
const envSchema = z.object({
  NEXT_PUBLIC_INSFORGE_URL: z
    .string()
    .url('NEXT_PUBLIC_INSFORGE_URL must be a valid URL'),
  NEXT_PUBLIC_INSFORGE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_INSFORGE_ANON_KEY must not be empty'),
});

function loadEnv(): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_INSFORGE_URL: process.env.NEXT_PUBLIC_INSFORGE_URL,
    NEXT_PUBLIC_INSFORGE_ANON_KEY: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid or missing environment variables:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();
