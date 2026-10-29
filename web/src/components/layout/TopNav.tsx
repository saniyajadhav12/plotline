"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const links = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/profile", label: "Profile" },
];

type TopNavProps = {
  /** Hide the page links (Home, Search, Watchlist, Profile), e.g. during first-time onboarding. */
  minimal?: boolean;
};

export function TopNav({ minimal = false }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;

    // Loads the user's name, and sends them to /login if their session is gone.
    // Only a 401 redirects; a backend outage or network error leaves them in place.
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          setName(data?.name ?? null);
          // Re-check the moment the session ends, so the user is sent to /login
          // automatically, without having to click or refresh.
          clearTimeout(expiryTimer);
          if (typeof data?.session_expires_at === "number") {
            const delay = Math.max(0, data.session_expires_at - Date.now()) + 1000;
            expiryTimer = setTimeout(checkSession, Math.min(delay, 2 ** 31 - 1));
          }
          return;
        }
        if (res.status === 401) {
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          router.replace(data?.reason === "session_expired" ? "/login?session_expired=1" : "/login");
        }
      } catch {
        // Network error: stay on the page.
      }
    }

    checkSession();

    // Re-check when the user comes back to this tab, so a session that ran out
    // in the background is caught immediately.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") checkSession();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearTimeout(expiryTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/85 backdrop-blur-md">
      <div className="page-container py-5 flex items-center justify-between gap-6">
        <Link
          href="/"
          className="shrink-0 whitespace-nowrap font-[family-name:var(--font-display)] text-2xl text-ink"
        >
          Plotline
        </Link>

        <nav className="flex items-center gap-4 md:gap-6 lg:gap-8 whitespace-nowrap">
          {!minimal && links.map((link) => {
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
            <span className="hidden lg:inline text-sm text-ink font-medium">Hi, {name}</span>
          )}
          <ThemeToggle />
          <button
            onClick={() => setShowConfirm(true)}
            className="text-sm text-silver hover:text-marquee transition-colors"
          >
            Sign out
          </button>
        </nav>
      </div>

    </header>

      {showConfirm && (
        <div className="fixed inset-0 bg-night/50 flex items-center justify-center z-50">
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
                className="text-sm px-4 py-2 bg-marquee text-cream hover:bg-marquee/90 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
