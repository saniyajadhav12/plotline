"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { parseErrorDetail } from "@/lib/errors";
import { useWarmUpBackend } from "@/lib/useWarmUpBackend";

export default function ForgotPasswordPage() {
  // Static page: start waking the free-tier backend as soon as it opens.
  useWarmUpBackend();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(parseErrorDetail(data.detail) || "Request failed");
      } else {
        // Same confirmation whether or not the account exists.
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const backToSignIn = (
    <>
      Remembered it?{" "}
      <Link href="/login" className="text-ink underline hover:text-marquee">
        Sign in
      </Link>
    </>
  );

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`If an account exists for ${email}, we've sent a link to reset your password.`}
        footer={backToSignIn}
      >
        <p className="text-sm text-silver mb-6">
          The link expires in 1 hour. Don&apos;t see it? Check your spam folder, or{" "}
          <button type="button" onClick={() => setSent(false)} className="text-ink underline hover:text-marquee">
            try again
          </button>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to choose a new one."
      footer={backToSignIn}
    >
      <form onSubmit={handleSubmit}>
        <FormField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        {error && <p className="text-marquee text-sm mb-4">{error}</p>}
        <SubmitButton loading={loading}>Send reset link</SubmitButton>
      </form>
    </AuthShell>
  );
}
