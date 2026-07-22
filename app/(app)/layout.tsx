import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

/**
 * Shared layout for authenticated app pages (/dashboard, /profile, /find-jobs).
 * Renders the Navbar (with session-aware CTA) and Footer around every page.
 * Route protection itself is handled by `proxy.ts`.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}
