"use client";

import { useState } from "react";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [devToken, setDevToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
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

      const data = await response.json();

      if (!response.ok) {
        setError(typeof data.detail === "string" ? data.detail : "Failed to change password");
      } else {
        setMessage("Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotMessage("");
    setForgotError("");
    setDevToken("");
    setForgotLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        setForgotError(typeof data.detail === "string" ? data.detail : "Request failed");
      } else {
        setForgotMessage(data.message);
        if (data.dev_reset_token) {
          setDevToken(data.dev_reset_token);
          setResetToken(data.dev_reset_token);
        }
      }
    } catch {
      setForgotError("Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotMessage("");
    setForgotError("");
    setForgotLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, new_password: resetNewPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setForgotError(typeof data.detail === "string" ? data.detail : "Reset failed");
      } else {
        setForgotMessage("Password reset successfully. You can now sign in with your new password.");
        setDevToken("");
        setResetToken("");
        setResetNewPassword("");
        setForgotEmail("");
      }
    } catch {
      setForgotError("Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="max-w-sm">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm text-ink mb-1.5">Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-ink/20 bg-paper px-3 py-2.5 text-ink focus:outline-none focus:border-marquee transition-colors"
          />
        </div>
        <div className="mb-2">
          <label className="block text-sm text-ink mb-1.5">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-ink/20 bg-paper px-3 py-2.5 text-ink focus:outline-none focus:border-marquee transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowForgot(!showForgot)}
          className="text-xs text-silver underline hover:text-ink transition-colors mb-4"
        >
          Forgot your current password?
        </button>
        {error && <p className="text-marquee text-sm mb-3">{error}</p>}
        {message && <p className="text-sm mb-3" style={{ color: "#2B3A42" }}>{message}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-ink text-paper px-5 py-2.5 text-sm font-medium hover:bg-marquee transition-colors disabled:opacity-50"
        >
          {loading ? "Saving…" : "Change Password"}
        </button>
      </form>

      {showForgot && (
        <div className="mt-6 border-t border-ink/10 pt-6">
          <p className="text-sm text-silver mb-4">
            No real email service is set up yet for this demo project, so the
            reset token is shown directly below instead of being emailed.
          </p>

          {!devToken ? (
            <form onSubmit={handleForgotSubmit} className="mb-4">
              <label className="block text-sm text-ink mb-1.5">Your email</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full border border-ink/20 bg-paper px-3 py-2.5 text-ink focus:outline-none focus:border-marquee transition-colors mb-3"
              />
              <button
                type="submit"
                disabled={forgotLoading}
                className="border border-ink/20 text-ink px-4 py-2 text-sm hover:border-ink/40 transition-colors disabled:opacity-50"
              >
                {forgotLoading ? "Sending…" : "Get reset token"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetSubmit}>
              <p className="text-xs text-silver mb-3">
                Dev reset token: <span className="text-ink font-mono">{devToken}</span>
              </p>
              <label className="block text-sm text-ink mb-1.5">New password</label>
              <input
                type="password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                className="w-full border border-ink/20 bg-paper px-3 py-2.5 text-ink focus:outline-none focus:border-marquee transition-colors mb-3"
              />
              <button
                type="submit"
                disabled={forgotLoading}
                className="bg-ink text-paper px-4 py-2 text-sm hover:bg-marquee transition-colors disabled:opacity-50"
              >
                {forgotLoading ? "Resetting…" : "Reset password"}
              </button>
            </form>
          )}

          {forgotError && <p className="text-marquee text-sm mt-3">{forgotError}</p>}
          {forgotMessage && (
            <p className="text-sm mt-3" style={{ color: "#2B3A42" }}>{forgotMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
