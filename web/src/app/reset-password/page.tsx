"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { parseErrorDetail } from "@/lib/errors";
import { useWarmUpBackend } from "@/lib/useWarmUpBackend";
import { newPasswordError } from "@/lib/passwordRules";

const PRIMARY_LINK =
  "inline-block bg-marquee text-cream px-5 py-2.5 text-sm font-medium hover:bg-marquee/90 transition-colors";

const signInFooter = (
  <Link href="/login" className="text-ink underline hover:text-marquee">
    Back to sign in
  </Link>
);

/** "checking" until the link is verified; "unknown" if the check itself failed (the form
 *  is shown anyway, since submitting verifies the token again). */
type LinkStatus = "checking" | "valid" | "invalid" | "unknown";

function ResetPasswordForm() {
  useWarmUpBackend();
  const token = useSearchParams().get("token") ?? "";
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check the link as soon as the page opens, so a used or expired link says so up front.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
      .then((data) => {
        if (!cancelled) setLinkStatus(data.valid === true ? "valid" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setLinkStatus("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return (
      <AuthShell title="Reset link incomplete" subtitle="This link is missing its reset code." footer={signInFooter}>
        <p className="text-sm text-ink mb-6">Open the link from your email again, or request a new one.</p>
        <Link href="/forgot-password" className={PRIMARY_LINK}>
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password reset" subtitle="You can now sign in with your new password." footer={signInFooter}>
        <Link href="/login" className={PRIMARY_LINK}>
          Sign in
        </Link>
      </AuthShell>
    );
  }

  if (linkStatus === "checking") {
    return (
      <AuthShell title="Checking your link…" subtitle="One moment." footer={signInFooter}>
        <p className="text-sm text-silver" aria-live="polite">
          This can take up to a minute if the server is waking up.
        </p>
      </AuthShell>
    );
  }

  if (linkStatus === "invalid") {
    return (
      <AuthShell
        title="This link has expired"
        subtitle="Reset links work once and expire after 1 hour."
        footer={signInFooter}
      >
        <Link href="/forgot-password" className={PRIMARY_LINK}>
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const passwordProblem = newPasswordError(password);
    const mismatch = password !== confirm;
    setPasswordError(passwordProblem);
    setConfirmError(!passwordProblem && mismatch ? "Passwords don't match." : "");
    if (passwordProblem || mismatch) return;

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (response.ok) {
        setDone(true);
      } else if (response.status === 400) {
        setLinkStatus("invalid"); // expired or already used since the page opened
      } else {
        const data = await response.json().catch(() => ({}));
        setError(parseErrorDetail(data.detail) || "Reset failed");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you haven't used here before." footer={signInFooter}>
      <form onSubmit={handleSubmit}>
        <FormField
          label="New password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={passwordError}
        />
        <FormField
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={confirmError}
        />
        {error && <p className="text-marquee text-sm mb-4">{error}</p>}
        <SubmitButton loading={loading}>Reset password</SubmitButton>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
