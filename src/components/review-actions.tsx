"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { requestNextProject } from "@/app/actions/learning";

export function ReviewActions({
  verdict,
  projectId,
  trackId,
  nextProjectId,
}: {
  verdict: "complete" | "needs_work";
  projectId: string;
  trackId: string;
  nextProjectId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (verdict === "needs_work") {
    return (
      <Link
        className="inline-flex rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        href={`/project/${projectId}`}
      >
        Improve &amp; resubmit
      </Link>
    );
  }

  if (nextProjectId) {
    return (
      <Link
        className="inline-flex rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        href={`/project/${nextProjectId}`}
      >
        Continue next project
      </Link>
    );
  }

  function unlockNextProject() {
    setError(null);
    startTransition(async () => {
      try {
        const project = await requestNextProject(trackId);
        router.push(`/project/${project.id}`);
      } catch {
        setError("Unable to unlock the next project right now.");
      }
    });
  }

  return (
    <div>
      <button
        className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={unlockNextProject}
        type="button"
      >
        {isPending ? "Unlocking…" : "Unlock next project"}
      </button>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
