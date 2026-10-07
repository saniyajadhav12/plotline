"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { parseErrorDetail } from "@/lib/errors";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const signupResponse = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!signupResponse.ok) {
        const data = await signupResponse.json();
        setError(parseErrorDetail(data.detail) || "Signup failed");
        setLoading(false);
        return;
      }

      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        router.push("/login");
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Tell us what you love. We'll take it from there."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-ink underline hover:text-marquee">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormField
          label="Name"
          type="text"
          value={name}
          onChange={setName}
          autoComplete="name"
        />
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
          autoComplete="new-password"
        />
        <p className="-mt-4 mb-5 text-sm text-silver">At least 8 characters.</p>
        {error && <p className="text-marquee text-sm mb-4">{error}</p>}
        <SubmitButton loading={loading}>Create account</SubmitButton>
      </form>
    </AuthShell>
  );
}
