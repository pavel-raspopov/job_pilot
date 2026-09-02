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

/**
 * Server-only environment variables.
 *
 * Deliberately a SEPARATE schema, validated on first read rather than at module
 * load. Do not fold these into `envSchema` above: this file is imported by
 * `lib/insforge-client.ts` (the browser client) and by `proxy.ts` (the Edge
 * proxy), and `loadEnv()` runs during module evaluation. Next.js inlines only
 * `NEXT_PUBLIC_*` into the client bundle, so a server-only key added to that
 * schema reads as `undefined` in the browser and throws while the bundle is
 * still evaluating — taking the page down.
 *
 * That failure would not show up today, because `lib/insforge-client.ts` has no
 * importers yet. It would appear the first time a client component imports it,
 * far from the change that caused it. Hence the split.
 *
 * `serverEnv()` throws on a misconfigured deploy, which is correct. Callers on a
 * request path catch it themselves so the user sees a service message rather
 * than a crash.
 */
const serverEnvSchema = z.object({
  ADZUNA_APP_ID: z.string().min(1, 'ADZUNA_APP_ID must not be empty'),
  ADZUNA_APP_KEY: z.string().min(1, 'ADZUNA_APP_KEY must not be empty'),
});

let serverEnvCache: z.infer<typeof serverEnvSchema> | null = null;

export function serverEnv(): z.infer<typeof serverEnvSchema> {
  if (serverEnvCache !== null) {
    return serverEnvCache;
  }

  const parsed = serverEnvSchema.safeParse({
    ADZUNA_APP_ID: process.env.ADZUNA_APP_ID,
    ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid or missing environment variables:\n${issues}`);
  }

  serverEnvCache = parsed.data;
  return serverEnvCache;
}
