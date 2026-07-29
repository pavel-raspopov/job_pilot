"use client";

import posthog from "posthog-js";
import { signOutAction } from "@/actions/auth";

// Client wrapper so we can reset the PostHog identity on the browser before the
// server action clears the session — required so a shared device does not keep
// attributing events to the previous user after logout.
export function LogoutButton() {
  const handleReset = (): void => {
    posthog.reset();
  };

  return (
    <form action={signOutAction}>
      <button
        type="submit"
        onClick={handleReset}
        className="bg-overlay-dark text-surface hover:opacity-90 transition-opacity px-4 py-2 rounded-md text-sm font-medium"
      >
        Log out
      </button>
    </form>
  );
}
