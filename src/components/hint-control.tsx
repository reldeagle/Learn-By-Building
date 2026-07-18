"use client";

import { useMemo, useState, useTransition } from "react";

import { requestHint } from "@/app/actions/learning";
import type { Hint } from "@/lib/schemas";

export function HintControl({
  projectId,
  hints,
  initiallyRevealed,
}: {
  projectId: string;
  hints: Hint[];
  initiallyRevealed: Hint[];
}) {
  const [revealed, setRevealed] = useState(initiallyRevealed);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasSolution = revealed.some((hint) => hint.isSolution);
  const regularHintCount = useMemo(
    () => hints.filter((hint) => !hint.isSolution).length,
    [hints],
  );
  const revealedRegularHints = revealed.filter(
    (hint) => !hint.isSolution,
  ).length;

  function revealHint() {
    setError(null);
    startTransition(async () => {
      try {
        const hint = await requestHint(projectId);
        setRevealed((current) =>
          current.some((item) => item.level === hint.level)
            ? current
            : [...current, hint].sort((a, b) => a.level - b.level),
        );
      } catch {
        setError("Unable to reveal a hint right now.");
      }
    });
  }

  if (hasSolution) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-100">Hints</p>
          <p className="text-xs text-slate-400">
            {revealed.length} of {hints.length} revealed
          </p>
        </div>
        <div className="mt-3 space-y-3">
          {revealed.map((hint) => (
            <p
              className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300"
              key={hint.level}
            >
              {hint.text}
            </p>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-100">Need a nudge?</p>
          <p className="mt-1 text-sm text-slate-400">
            Hints reveal one step at a time. {revealed.length} of {hints.length}{" "}
            revealed.
          </p>
        </div>
        <button
          className="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-cyan-300 transition hover:border-cyan-300/60 disabled:opacity-60"
          disabled={isPending}
          onClick={revealHint}
          type="button"
        >
          {isPending
            ? "Revealing…"
            : revealedRegularHints >= regularHintCount
              ? "Show solution"
              : "Show a hint"}
        </button>
      </div>
      {revealed.length ? (
        <div className="mt-4 space-y-3">
          {revealed.map((hint) => (
            <p
              className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300"
              key={hint.level}
            >
              {hint.text}
            </p>
          ))}
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
