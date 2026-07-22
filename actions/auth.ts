'use server';

import { createAuthActions } from '@insforge/sdk/ssr';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

type OAuthProvider = 'google' | 'github';

type SignInWithOAuthResult = {
  success: boolean;
  url?: string;
  error?: string;
};

/**
 * Derive the current app origin from request headers.
 *
 * We do NOT accept an origin/redirect URL from the client — that keeps the
 * OAuth callback pinned to the deployed origin and prevents anyone from
 * initiating a sign-in against a spoofed callback URL. If a
 * `NEXT_PUBLIC_APP_URL` env is present it wins; otherwise we fall back to
 * the standard `x-forwarded-*` / `host` headers.
 */
async function resolveAppOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  const proto = headerList.get('x-forwarded-proto') ?? 'http';
  if (!host) {
    throw new Error('Cannot resolve app origin: no host header');
  }
  return `${proto}://${host}`;
}

export async function signInWithOAuthAction(
  provider: OAuthProvider,
): Promise<SignInWithOAuthResult> {
  try {
    const origin = await resolveAppOrigin();
    const redirectTo = `${origin}/callback`;

    const cookieStore = await cookies();
    const authActions = createAuthActions({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
      cookies: cookieStore,
    });

    const { data, error } = await authActions.signInWithOAuth(provider, {
      redirectTo,
      skipBrowserRedirect: true,
    });

    if (error || !data?.url) {
      console.error('[actions/auth] signInWithOAuth', error);
      return {
        success: false,
        error: 'Could not start sign-in. Please try again.',
      };
    }

    return { success: true, url: data.url };
  } catch (error) {
    console.error('[actions/auth] signInWithOAuth exception', error);
    return {
      success: false,
      error: 'Could not start sign-in. Please try again.',
    };
  }
}

/**
 * Sign the current user out.
 *
 * Uses `createAuthActions` (full CookieStore) so the session cookies are
 * actually deleted. Then invalidates the router cache with
 * `revalidatePath('/', 'layout')` before redirecting to `/login`, so any
 * cached RSC payloads showing authenticated-only UI (e.g. the "Log out"
 * button in the Navbar) are refetched on the next navigation.
 */
export async function signOutAction(): Promise<never> {
  try {
    const cookieStore = await cookies();
    const authActions = createAuthActions({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
      cookies: cookieStore,
    });
    const { error } = await authActions.signOut();
    if (error) {
      console.error('[actions/auth] signOut', error);
    }
  } catch (error) {
    console.error('[actions/auth] signOut exception', error);
  }

  revalidatePath('/', 'layout');
  redirect('/login');
}
