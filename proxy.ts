import { updateSession, type CookieStore } from '@insforge/sdk/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard', '/profile', '/find-jobs'];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // The SDK's CookieStore.set/delete are declared as function overloads
  // ((name, value, options) | (options-object)). A single-signature arrow
  // implementation is not assignable to the overload union, so we cast the
  // object literal to CookieStore. At runtime updateSession only invokes the
  // (name, value, options) form, which Next.js request/response cookies
  // support directly.
  const requestCookies = {
    get: (name: string) => request.cookies.get(name),
    set: (name: string, value: string) => {
      request.cookies.set(name, value);
    },
    delete: (name: string) => {
      request.cookies.delete(name);
    },
  } as CookieStore;

  const responseCookies = {
    get: (name: string) => response.cookies.get(name),
    set: (
      name: string,
      value: string,
      options?: Parameters<typeof response.cookies.set>[2],
    ) => {
      response.cookies.set(name, value, options);
    },
    delete: (name: string) => {
      response.cookies.delete(name);
    },
  } as CookieStore;

  const { accessToken } = await updateSession({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    requestCookies,
    responseCookies,
  });

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (isProtectedRoute && !accessToken) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
