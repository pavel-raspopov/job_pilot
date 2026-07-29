import { createBrowserClient } from '@insforge/sdk/ssr';
import { env } from '@/lib/env';

export const insforge = createBrowserClient({
  baseUrl: env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
});
