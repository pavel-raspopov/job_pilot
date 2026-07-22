import { createAuthActions } from '@insforge/sdk/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('insforge_code');
  const origin = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=Missing%20authentication%20code', origin),
    );
  }

  try {
    const cookieStore = await cookies();

    const authActions = createAuthActions({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
      cookies: cookieStore,
    });

    const { error } = await authActions.exchangeOAuthCode(code);

    if (error) {
      console.error('[auth/callback] exchangeOAuthCode', error);
      return NextResponse.redirect(
        new URL('/login?error=Could%20not%20complete%20sign-in', origin),
      );
    }
  } catch (error) {
    console.error('[auth/callback] exception', error);
    return NextResponse.redirect(
      new URL('/login?error=Could%20not%20complete%20sign-in', origin),
    );
  }

  return NextResponse.redirect(new URL('/dashboard', origin));
}
