import { createServerClient } from '@insforge/sdk/ssr';
import { cookies } from 'next/headers';

/**
 * InsForge server client for **read-only** session use.
 *
 * Use this in Server Components, Server Actions, and Route Handlers when you
 * only need to read the current user or query the database on their behalf.
 *
 * ⚠️ **Do NOT use this to sign in, sign out, or exchange OAuth codes.**
 * `createServerClient` receives the cookie store as read-only, so any call
 * that needs to WRITE session cookies (e.g. `auth.signOut()`,
 * `auth.exchangeOAuthCode()`, `auth.signInWithPassword()`) will silently fail
 * to persist the new session state.
 *
 * For cookie-writing auth calls, use `createAuthActions({ ..., cookies })`
 * directly from `@insforge/sdk/ssr` inside a Server Action or Route Handler.
 */
export async function createInsforgeServer() {
  const cookieStore = await cookies();

  return createServerClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    cookies: cookieStore,
  });
}
