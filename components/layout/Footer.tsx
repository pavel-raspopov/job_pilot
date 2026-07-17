import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full bg-surface border-t border-border py-8 px-8">
      <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="JobPilot"
            width={130}
            height={36}
            className="h-9 w-auto"
          />
        </Link>

        <div className="flex flex-wrap justify-center gap-8">
          <Link
            href="/dashboard"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="#"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="#"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Terms &amp; Condition
          </Link>
        </div>
      </div>
    </footer>
  );
}
