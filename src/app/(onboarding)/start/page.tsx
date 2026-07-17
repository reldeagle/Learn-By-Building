import { OnboardingForm } from "@/components/onboarding-form";

export default function StartPage() {
  return (
    <main className="flex min-h-full flex-1 items-center bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/40 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Learn By Building
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Start your React track
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          A short calibration helps your mentor choose a first project that is
          challenging without being overwhelming.
        </p>
        <div className="mt-10">
          <OnboardingForm />
        </div>
      </section>
    </main>
  );
}
