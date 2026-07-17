import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <section className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/40 sm:p-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Learn By Building
        </p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Build projects. Get mentored. Earn the next challenge.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
          Pick a project, build it in your own editor, and get practical
          feedback that explains what to improve and why.
        </p>
        <Link
          className="mt-8 inline-flex rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          href="/start"
        >
          Start your React track
        </Link>
      </section>
    </main>
  );
}
