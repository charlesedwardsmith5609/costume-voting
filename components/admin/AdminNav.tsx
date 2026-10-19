"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Timer" },
  { href: "/admin/results", label: "Results" },
  { href: "/admin/nominees", label: "Nominees" },
  { href: "/admin/tools", label: "Tools" },
];

// Top nav for admin pages. Hidden when printing (the QR page is printed).
export function AdminNav({ onSignOut }: { onSignOut: () => void }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === href : path.startsWith(href));
  return (
    <nav className="sticky top-0 z-20 border-b border-white/10 bg-night/95 print:hidden">
      <div className="mx-auto flex max-w-2xl items-center gap-1 overflow-x-auto px-2">
        {LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`inline-flex min-h-12 items-center px-3 text-lg font-semibold ${
              active(href) ? "text-pumpkin underline underline-offset-8" : "text-violet-200"
            }`}
          >
            {label}
          </Link>
        ))}
        <button type="button" onClick={onSignOut} className="ml-auto min-h-12 shrink-0 px-3 text-violet-300">
          Log out
        </button>
      </div>
    </nav>
  );
}
