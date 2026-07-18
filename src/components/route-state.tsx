"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export function RouteLoading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="flex min-h-full flex-1 items-center bg-slate-950 px-6 py-16 text-slate-100">
      <section
        aria-busy="true"
        aria-live="polite"
        className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8"
      >
        <div className="size-8 animate-pulse rounded-lg bg-cyan-300/20" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      </section>
    </main>
  );
}

export function RouteError({
  title,
  description,
  returnHref,
  returnLabel,
  reset,
}: {
  title: string;
  description: string;
  returnHref: string;
  returnLabel: string;
  reset: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <main className="flex min-h-full flex-1 items-center bg-slate-950 px-6 py-16 text-slate-100">
      <section
        className="mx-auto w-full max-w-xl rounded-2xl border border-rose-400/25 bg-slate-900 p-6 sm:p-8"
        role="alert"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-rose-200">
          Something went wrong
        </p>
        <h1
          className="mt-3 text-2xl font-semibold tracking-tight text-slate-100"
          ref={heading}
          tabIndex={-1}
        >
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <Link
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
            href={returnHref}
          >
            {returnLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
