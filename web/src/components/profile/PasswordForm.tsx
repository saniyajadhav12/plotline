"use client";

import { useState } from "react";
import Link from "next/link";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { parseErrorDetail } from "@/lib/errors";
import { newPasswordError, SAME_PASSWORD_MESSAGE } from "@/lib/passwordRules";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentError, setCurrentError] = useState("");
  const [newError, setNewError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  // Bumped after a successful change so the fields remount and every Show/Hide toggle resets.
  const [formKey, setFormKey] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Check everything locally first, and show each problem under its own field.
    const missingCurrent = currentPassword.length === 0;
    let newProblem = newPasswordError(newPassword);
    if (!newProblem && !missingCurrent && newPassword === currentPassword) {
      newProblem = SAME_PASSWORD_MESSAGE;
    }
    const mismatch = newPassword !== confirm;

    setCurrentError(missingCurrent ? "Enter your current password." : "");
    setNewError(newProblem);
    setConfirmError(!newProblem && mismatch ? "Passwords don't match." : "");
    if (missingCurrent || newProblem || mismatch) return;

    setLoading(true);
    try {
      const response = await fetch("/api/users/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirm("");
        setFormKey((key) => key + 1);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(parseErrorDetail(data.detail));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm">
      <form onSubmit={handleSubmit} noValidate>
        <div key={formKey}>
        <FormField
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
          error={currentError}
        />
        <FormField
          label="New password"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          error={newError}
        />
        <FormField
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={confirmError}
        />
        </div>
        <div className="mb-5">
          <Link href="/forgot-password" className="text-xs text-silver underline hover:text-ink transition-colors">
            Forgot your current password? Reset it by email
          </Link>
        </div>
        {error && <p className="text-marquee text-sm mb-4">{error}</p>}
        {success && (
          <p role="status" className="text-sm text-ink mb-4">
            Password updated.
          </p>
        )}
        <SubmitButton loading={loading}>Change password</SubmitButton>
      </form>
    </div>
  );
}
