import { cookies } from "next/headers";
import { createServerClient } from "@insforge/sdk/ssr";
import { env } from "@/lib/env";

/**
 * The SDK's HTTP client defaults to a 30s timeout, which a real model call
 * exceeds: the gateway may have to fetch a document, parse it, and run the
 * model. Session reads keep the default — only AI calls need the longer
 * window, so they get their own client rather than loosening the shared one.
 *
 * Any route using this client must also set `export const maxDuration` to at
 * least this value, or the platform kills the request first. See the note on
 * `maxDuration` in the AI routes.
 */
export const AI_TIMEOUT_MS = 120_000;

/**
 * Client for InsForge AI gateway calls, with the long timeout above.
 *
 * Deliberately separate from `createInsforgeServer()` in `lib/insforge-server.ts`,
 * whose 30s default is correct for session and database reads and must not be
 * loosened to accommodate a slow model call.
 */
export async function createAiClient() {
  const cookieStore = await cookies();
  return createServerClient({
    baseUrl: env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    cookies: cookieStore,
    timeout: AI_TIMEOUT_MS,
  });
}
