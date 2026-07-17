"use client";

import { useState, useTransition } from "react";

import { submitReviewFeedback } from "@/app/actions/learning";

type Rating = "thumbs_up" | "thumbs_down";

export function ReviewFeedback({
  reviewId,
  initialRating,
}: {
  reviewId: string;
  initialRating: Rating | null;
}) {
  const [rating, setRating] = useState<Rating | null>(initialRating);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveRating(nextRating: Rating) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitReviewFeedback({
          reviewId,
          rating: nextRating,
        });
        setRating(result.rating);
      } catch {
        setError("Unable to save your feedback right now.");
      }
    });
  }

  return (
    <section className="border-t border-slate-800 pt-6">
      <p className="text-sm font-medium text-slate-100">
        Was this review useful?
      </p>
      <div className="mt-3 flex gap-3">
        <button
          aria-pressed={rating === "thumbs_up"}
          className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-cyan-300/60 disabled:opacity-60"
          disabled={isPending}
          onClick={() => saveRating("thumbs_up")}
          type="button"
        >
          Thumbs up
        </button>
        <button
          aria-pressed={rating === "thumbs_down"}
          className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-cyan-300/60 disabled:opacity-60"
          disabled={isPending}
          onClick={() => saveRating("thumbs_down")}
          type="button"
        >
          Thumbs down
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
