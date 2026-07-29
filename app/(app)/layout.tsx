import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { createInsforgeServer } from "@/lib/insforge-server";
import { PostHogIdentify } from "@/components/PostHogIdentify";

/**
 * Shared layout for authenticated app pages (/dashboard, /profile, /find-jobs).
 * Renders the Navbar (with session-aware CTA) and Footer around every page.
 * Route protection itself is handled by `proxy.ts`.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const insforge = await createInsforgeServer();
  const { data } = await insforge.auth.getCurrentUser();
  const user = data?.user;

  return (
    <div className="flex flex-col min-h-screen">
      {user && <PostHogIdentify userId={user.id} email={user.email} />}
      <Navbar />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}
