'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

interface PostHogIdentifyProps {
  userId: string;
  email?: string | null;
}

export function PostHogIdentify({ userId, email }: PostHogIdentifyProps) {
  useEffect(() => {
    posthog.identify(userId, { email: email ?? undefined });
  }, [userId, email]);

  return null;
}
