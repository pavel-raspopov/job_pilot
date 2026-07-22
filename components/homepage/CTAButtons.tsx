import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createInsforgeServer } from "@/lib/insforge-server";

export async function CTAButtons() {
  const insforge = await createInsforgeServer();
  const { data } = await insforge.auth.getCurrentUser();
  const user = data?.user;
  
  const targetRoute = user ? "/dashboard" : "/login";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      <Link
        href={targetRoute}
        className="inline-flex items-center gap-2 bg-overlay-dark text-surface hover:opacity-90 transition-opacity px-4 py-2 rounded-md text-sm font-medium"
      >
        Get Started
        <ArrowRight className="h-4 w-4" />
      </Link>
      <Link
        href={targetRoute}
        className="inline-flex items-center bg-surface border border-border text-text-primary hover:bg-surface-secondary transition-colors px-4 py-2 rounded-md text-sm font-medium"
      >
        Find Your First Match
      </Link>
    </div>
  );
}
