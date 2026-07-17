"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startTrack } from "@/app/actions/learning";

const levels = [
  ["beginner", "Beginner", "I am still getting comfortable with JavaScript."],
  [
    "intermediate",
    "Intermediate",
    "I have built a few small JavaScript projects.",
  ],
  [
    "experienced",
    "Experienced",
    "I am ready for a more demanding React challenge.",
  ],
] as const;

export function OnboardingForm() {
  const router = useRouter();
  const [jsExperience, setJsExperience] = useState("");
  const [level, setLevel] = useState<
    "beginner" | "intermediate" | "experienced"
  >("beginner");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!jsExperience.trim()) {
      setError("Tell your mentor a little about your JavaScript experience.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await startTrack({
          technology: "react",
          jsExperience,
          level,
        });
        router.push(`/project/${result.project.id}`);
      } catch {
        setError("We could not start your track. Sign in and try again.");
      }
    });
  }

  return (
    <form className="space-y-8" onSubmit={submit}>
      <fieldset>
        <legend className="text-sm font-medium text-slate-100">
          Choose a technology
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <button
            aria-pressed="true"
            className="rounded-xl border border-cyan-400/35 bg-cyan-400/10 px-4 py-4 text-left"
            type="button"
          >
            <span className="block font-medium text-cyan-100">React</span>
            <span className="mt-1 block text-sm text-cyan-200/80">
              Available now
            </span>
          </button>
          <button
            className="cursor-not-allowed rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4 text-left opacity-60"
            disabled
            type="button"
          >
            <span className="block font-medium text-slate-300">TypeScript</span>
            <span className="mt-1 block text-sm text-slate-500">Locked</span>
          </button>
          <button
            className="cursor-not-allowed rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4 text-left opacity-60"
            disabled
            type="button"
          >
            <span className="block font-medium text-slate-300">Node.js</span>
            <span className="mt-1 block text-sm text-slate-500">Locked</span>
          </button>
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-slate-100">
          What is your JavaScript experience?
        </span>
        <textarea
          className="mt-3 min-h-28 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300"
          maxLength={1000}
          onChange={(event) => setJsExperience(event.target.value)}
          placeholder="For example: I finished a tutorial and have built a small todo app."
          value={jsExperience}
        />
        <span className="mt-2 block text-right text-xs text-slate-500">
          {jsExperience.length}/1000
        </span>
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-slate-100">
          Where should we start?
        </legend>
        <div className="mt-3 grid gap-3">
          {levels.map(([value, label, description]) => (
            <button
              aria-pressed={level === value}
              className={`rounded-xl border p-4 text-left transition ${
                level === value
                  ? "border-cyan-400/35 bg-cyan-400/10"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
              key={value}
              onClick={() => setLevel(value)}
              type="button"
            >
              <span className="font-medium text-slate-100">{label}</span>
              <span className="mt-1 block text-sm text-slate-400">
                {description}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <button
        className="w-full rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Starting your track…" : "Start Project 1"}
      </button>

      <p className="text-center text-sm text-slate-400">
        Need to sign in first?{" "}
        <Link
          className="text-cyan-300 underline underline-offset-4"
          href="/api/auth/signin?callbackUrl=/start"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
