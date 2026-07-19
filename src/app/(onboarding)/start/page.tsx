import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding-form";
import { getSignInUrl } from "@/lib/auth-redirect";
import { UnauthorizedError, requireUser } from "@/lib/auth";

export const maxDuration = 60;

export default async function StartPage() {
  let user;

  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(getSignInUrl("/start"));
    }
    throw error;
  }

  return (
    <main className="flex min-h-full flex-1 items-center bg-slate-950 px-6 py-12 text-slate-100 sm:py-16">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/40 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Setup · Step 1 of 2
          </p>
          <p className="rounded-full border border-slate-800 px-3 py-1 text-xs font-medium text-slate-400">
            About 2 minutes
          </p>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Start your React track
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          A short calibration helps your mentor choose a first project that is
          challenging without being overwhelming.
        </p>
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
          <span className="flex size-7 items-center justify-center rounded-lg bg-cyan-300 text-xs font-bold text-slate-950">
            R
          </span>
          <span>
            <span className="font-medium">Selected stack:</span> React
          </span>
        </div>
        <div className="mt-10">
          <OnboardingForm userEmail={user.email} />
        </div>
      </section>
    </main>
  );
}
