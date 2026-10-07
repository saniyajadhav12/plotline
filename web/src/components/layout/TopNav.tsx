"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/profile", label: "Profile" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setName(data?.name ?? null))
      .catch(() => setName(null));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-ink/10 bg-paper">
      <div className="max-w-6xl mx-auto px-8 sm:px-16 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-2xl text-ink"
        >
          Plotline
        </Link>

        <nav className="flex items-center gap-8">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  isActive ? "text-ink font-medium" : "text-silver hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {name && (
            <span className="text-sm text-ink font-medium">Hi, {name}</span>
          )}
          <button
            onClick={() => setShowConfirm(true)}
            className="text-sm text-silver hover:text-marquee transition-colors"
          >
            Sign out
          </button>
        </nav>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50">
          <div className="bg-paper border border-ink/10 shadow-lg max-w-sm w-full mx-4 p-6">
            <h2 className="font-[family-name:var(--font-display)] text-xl text-ink mb-2">
              Sign out?
            </h2>
            <p className="text-sm text-silver mb-6">
              Are you sure you want to sign out of Plotline?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="text-sm px-4 py-2 border border-ink/20 text-ink hover:border-ink/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="text-sm px-4 py-2 bg-marquee text-paper hover:bg-marquee/90 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
