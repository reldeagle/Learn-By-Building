import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/sign-in-form";
import { getSafeCallbackPath } from "@/lib/auth-redirect";
import { authOptions, getAuthProviderAvailability } from "@/lib/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const [{ callbackUrl, error }, session] = await Promise.all([
    searchParams,
    getServerSession(authOptions),
  ]);
  const safeCallbackUrl = getSafeCallbackPath(callbackUrl);

  if (session?.user?.email) {
    redirect(safeCallbackUrl);
  }

  const providers = getAuthProviderAvailability();

  return (
    <main className="flex min-h-full flex-1 items-center bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Learn By Building
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Continue learning
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Sign in to save your projects, feedback, and progression.
        </p>
        <div className="mt-8">
          <SignInForm
            callbackUrl={safeCallbackUrl}
            developmentCredentialsEnabled={providers.developmentCredentials}
            googleEnabled={providers.google}
            initialError={error}
          />
        </div>
      </section>
    </main>
  );
}
