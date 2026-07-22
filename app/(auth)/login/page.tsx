'use client';

import { signInWithOAuthAction } from '@/actions/auth';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 496 512"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" />
    </svg>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * Extracted so it can safely call `useSearchParams()` under a Suspense
 * boundary — Next 15/16 forces client components that read search params
 * into dynamic rendering and warns loudly if not wrapped.
 */
function LoginCard() {
  const searchParams = useSearchParams();
  const initialError = searchParams.get('error');
  const [error, setError] = useState<string | null>(initialError);
  const [loadingProvider, setLoadingProvider] = useState<
    'google' | 'github' | null
  >(null);

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setError(null);
    setLoadingProvider(provider);

    const result = await signInWithOAuthAction(provider);

    if (!result.success || !result.url) {
      setError(result.error ?? 'Could not start sign-in. Please try again.');
      setLoadingProvider(null);
      return;
    }

    window.location.href = result.url;
  };

  return (
    <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-card">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">
          Welcome to JobPilot
        </h1>
        <p className="text-sm text-text-secondary">
          Sign in to start finding jobs that match your profile.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary"
        >
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleOAuthLogin('google')}
          disabled={loadingProvider !== null}
          className="w-full flex items-center justify-center gap-3 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <GoogleIcon className="h-5 w-5" />
          {loadingProvider === 'google'
            ? 'Redirecting…'
            : 'Continue with Google'}
        </button>

        <button
          type="button"
          onClick={() => handleOAuthLogin('github')}
          disabled={loadingProvider !== null}
          className="w-full flex items-center justify-center gap-3 rounded-md bg-overlay-dark px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition-opacity focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <GithubIcon className="h-5 w-5" />
          {loadingProvider === 'github'
            ? 'Redirecting…'
            : 'Continue with GitHub'}
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-text-muted">
        By signing in, you agree to our{' '}
        <Link
          href="#"
          className="font-medium text-text-secondary underline underline-offset-4 hover:text-text-primary"
        >
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link
          href="#"
          className="font-medium text-text-secondary underline underline-offset-4 hover:text-text-primary"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

function LoginCardFallback() {
  return (
    <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-card">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">
          Welcome to JobPilot
        </h1>
        <p className="text-sm text-text-secondary">Loading…</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={<LoginCardFallback />}>
        <LoginCard />
      </Suspense>
    </div>
  );
}
