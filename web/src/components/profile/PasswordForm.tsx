"use client";

import { useState } from "react";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <form onSubmit={handleSubmit} className="max-w-sm">
      <div className="mb-4">
        <label className="block text-sm text-ink mb-1.5">Current password</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full border border-ink/20 bg-paper px-3 py-2.5 text-ink focus:outline-none focus:border-marquee transition-colors"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm text-ink mb-1.5">New password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border border-ink/20 bg-paper px-3 py-2.5 text-ink focus:outline-none focus:border-marquee transition-colors"
        />
      </div>
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
  );
}
