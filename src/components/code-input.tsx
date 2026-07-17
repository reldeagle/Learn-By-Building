"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MAX_SUBMISSION_CHARACTERS } from "@/lib/schemas";

export function CodeInput({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (file.size > MAX_SUBMISSION_CHARACTERS) {
      setError("Choose a code file smaller than 100 KB.");
      return;
    }

    const content = await file.text();
    if (content.length > MAX_SUBMISSION_CHARACTERS) {
      setError("Choose a code file smaller than 100 KB.");
      return;
    }

    setError(null);
    setCode(content);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!code.trim()) {
      setError("Paste your code or upload a file before requesting a review.");
      return;
    }

    window.sessionStorage.setItem(
      `learn-by-building:submission:${projectId}`,
      code,
    );
    router.push(`/project/${projectId}/review?submit=1`);
  }

  return (
    <form
      className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6"
      onSubmit={submit}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-semibold tracking-tight text-slate-100">
            Submit your code
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Paste your implementation or upload one text-based source file.
          </p>
        </div>
        <label className="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-cyan-300 transition hover:border-cyan-300/60">
          Upload file
          <input
            accept=".js,.jsx,.ts,.tsx,.txt"
            className="sr-only"
            onChange={(event) => {
              void loadFile(event.target.files?.[0]);
              event.target.value = "";
            }}
            type="file"
          />
        </label>
      </div>
      <textarea
        className="mt-5 min-h-72 w-full rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300"
        maxLength={MAX_SUBMISSION_CHARACTERS}
        onChange={(event) => {
          setError(null);
          setCode(event.target.value);
        }}
        placeholder="Paste the code you want your mentor to review."
        spellCheck={false}
        value={code}
      />
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          {code.length.toLocaleString()}/
          {MAX_SUBMISSION_CHARACTERS.toLocaleString()} characters
        </p>
        <button
          className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          type="submit"
        >
          Request review
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </form>
  );
}
