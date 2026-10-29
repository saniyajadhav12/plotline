"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/auth/FormField";
import { parseErrorDetail } from "@/lib/errors";

export function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function close() {
    if (loading) return;
    setOpen(false);
    setPassword("");
    setPasswordError("");
    setError("");
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!password) {
      setPasswordError("Enter your password to confirm.");
      return;
    }
    setPasswordError("");
    setLoading(true);

    try {
      const response = await fetch("/api/users/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        // Stay in the loading state while we navigate away.
        router.replace("/login?account_deleted=1");
        router.refresh();
        return;
      }
      const data = await response.json().catch(() => ({}));
      setError(parseErrorDetail(data.detail));
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  return (
    <>
      <p className="text-sm text-silver mb-5 max-w-xl">
        Permanently delete your account and everything in it: your ratings, watchlist, taste
        preferences and recommendations. This can&apos;t be undone.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm px-5 py-2.5 border border-marquee text-marquee hover:bg-marquee hover:text-cream transition-colors"
      >
        Delete account
      </button>

      {open && (
        <div className="fixed inset-0 bg-night/50 flex items-center justify-center z-50">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="bg-paper border border-ink/10 shadow-lg max-w-sm w-full mx-4 p-6"
          >
            <h2
              id="delete-account-title"
              className="font-[family-name:var(--font-display)] text-xl text-ink mb-2"
            >
              Delete your account?
            </h2>
            <p className="text-sm text-silver mb-5">
              Your ratings, watchlist, preferences and recommendations will be deleted for good.
              Enter your password to confirm.
            </p>
            <form onSubmit={handleDelete} noValidate>
              <FormField
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                error={passwordError}
              />
              {error && <p className="text-marquee text-sm mb-4">{error}</p>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={loading}
                  className="text-sm px-4 py-2 border border-ink/20 text-ink hover:border-ink/40 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="text-sm px-4 py-2 bg-marquee text-cream hover:bg-marquee/90 transition-colors disabled:opacity-50"
                >
                  {loading ? "Deleting…" : "Delete my account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
