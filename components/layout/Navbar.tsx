import Image from "next/image";
import Link from "next/link";
import { createInsforgeServer } from "@/lib/insforge-server";
import { NavbarNav } from "@/components/layout/NavbarNav";
import { signOutAction } from "@/actions/auth";

export async function Navbar() {
  const insforge = await createInsforgeServer();
  const { data } = await insforge.auth.getCurrentUser();
  const isAuthed = Boolean(data?.user);

  return (
    <header className="sticky top-0 z-50 w-full h-16 bg-surface border-b border-border">
      <div className="max-w-[1440px] mx-auto h-full px-6 grid grid-cols-[1fr_auto_1fr] items-center">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="JobPilot"
            width={106}
            height={36}
            priority
            className="h-9 w-auto"
          />
        </Link>

        <NavbarNav />

        <div className="flex justify-end">
          {isAuthed ? (
            <form action={signOutAction}>
              <button
                type="submit"
                className="bg-overlay-dark text-surface hover:opacity-90 transition-opacity px-4 py-2 rounded-md text-sm font-medium"
              >
                Log out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="bg-overlay-dark text-surface hover:opacity-90 transition-opacity px-4 py-2 rounded-md text-sm font-medium"
            >
              Start for Free
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
