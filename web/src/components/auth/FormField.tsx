"use client";

import { useState } from "react";

export function FormField({
  label,
  type,
  value,
  onChange,
  autoComplete,
  error,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  error?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <div className="mb-5">
      <label className="block text-sm text-ink mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full border border-ink/20 bg-paper px-3 py-2.5 pr-12 text-ink placeholder:text-silver focus:outline-none focus:border-marquee transition-colors"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((current) => (current ? false : true))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-silver hover:text-ink transition-colors"
            tabIndex={-1}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-sm text-marquee">{error}</p>}
    </div>
  );
}
