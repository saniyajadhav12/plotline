"use client";

import { useState } from "react";

const REGIONS = [
  { code: "US", label: "United States" },
  { code: "IN", label: "India" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
];

export function RegionSelector({ initialRegion }: { initialRegion: string }) {
  const [region, setRegion] = useState(initialRegion);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleChange(newRegion: string) {
    setRegion(newRegion);
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/users/region", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region_preference: newRegion }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={region}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="border border-ink/20 bg-paper px-3 py-2.5 text-ink focus:outline-none focus:border-marquee transition-colors"
      >
        {REGIONS.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
          </option>
        ))}
      </select>
      {saved && !saving && <span className="text-sm text-silver">Saved</span>}
    </div>
  );
}
