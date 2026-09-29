"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GenreStep } from "@/components/onboarding/GenreStep";
import { MovieStep } from "@/components/onboarding/MovieStep";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [genres, setGenres] = useState<string[]>([]);
  const [movieIds, setMovieIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_genres: genres,
          selected_movie_ids: movieIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.detail || "Failed to save your preferences. Please try again.");
        setSubmitting(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper px-8 py-12 sm:px-16">
      <div className="max-w-3xl mx-auto">
        {step === 1 ? (
          <GenreStep
            selected={genres}
            onChange={setGenres}
            onNext={() => setStep(2)}
          />
        ) : (
          <MovieStep
            selected={movieIds}
            onChange={setMovieIds}
            onBack={() => setStep(1)}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
