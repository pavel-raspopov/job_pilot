"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Find Jobs", href: "/find-jobs" },
    { label: "Profile", href: "/profile" },
  ];

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

        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? "text-accent"
                    : "text-text-dark hover:text-accent"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex justify-end">
          <Link
            href="/login"
            className="bg-overlay-dark text-surface hover:opacity-90 transition-opacity px-4 py-2 rounded-md text-sm font-medium"
          >
            Start for Free
          </Link>
        </div>
      </div>
    </header>
  );
}
