"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { parseErrorDetail } from "@/lib/errors";
import { useWarmUpBackend } from "@/lib/useWarmUpBackend";

/** Shared style for the notices shown above the form (session expired, account deleted). */
const NOTICE_CLASS =
  "text-sm text-ink mb-5 bg-gold/15 border border-gold/30 border-l-4 border-l-gold px-4 py-3";

function LoginForm() {
  const router = useRouter();
  // This page renders without the backend, so start waking it now (free tier sleeps when idle).
  useWarmUpBackend();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("session_expired") === "1";
  const accountDeleted = searchParams.get("account_deleted") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(parseErrorDetail(data.detail) || "Login failed");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see what's next."
      footer={
        <>
          New to Plotline?{" "}
          <Link href="/signup" className="text-ink underline hover:text-marquee">
            Create an account
          </Link>
        </>
      }
    >
      {sessionExpired && (
        <p className={NOTICE_CLASS}>
          Your session expired. Please sign in again.
        </p>
      )}
      {accountDeleted && (
        <p role="status" className={NOTICE_CLASS}>
          Your account has been deleted.
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <FormField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <FormField
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <p className="-mt-2 mb-4 text-right text-sm">
          <Link href="/forgot-password" className="text-silver underline hover:text-ink">
            Forgot password?
          </Link>
        </p>
        {error && <p className="text-marquee text-sm mb-4">{error}</p>}
        <SubmitButton loading={loading}>Sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
