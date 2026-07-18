"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SignInFormProps = {
  callbackUrl: string;
  developmentCredentialsEnabled: boolean;
  googleEnabled: boolean;
  initialError?: string;
};

function errorMessage(error?: string) {
  if (error === "CredentialsSignin") {
    return "Those development credentials did not match. Please try again.";
  }

  if (error) {
    return "We could not complete sign-in. Please try again.";
  }

  return null;
}

export function SignInForm({
  callbackUrl,
  developmentCredentialsEnabled,
  googleEnabled,
  initialError,
}: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorMessage(initialError));
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        callbackUrl,
        email,
        password,
        redirect: false,
      });

      if (!result?.ok) {
        setError(errorMessage(result?.error ?? undefined));
        setIsSubmitting(false);
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError("We could not complete sign-in. Please try again.");
      setIsSubmitting(false);
    }
  }

  async function submitGoogle() {
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("We could not complete sign-in. Please try again.");
      setIsSubmitting(false);
    }
  }

  if (!googleEnabled && !developmentCredentialsEnabled) {
    return (
      <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
        Sign-in is not configured yet. Add Google OAuth credentials to continue.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {googleEnabled ? (
        <button
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          onClick={() => void submitGoogle()}
          type="button"
        >
          <span
            aria-hidden="true"
            className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-900"
          >
            G
          </span>
          Continue with Google
        </button>
      ) : null}

      {googleEnabled && developmentCredentialsEnabled ? (
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-800" />
          Development only
          <span className="h-px flex-1 bg-slate-800" />
        </div>
      ) : null}

      {developmentCredentialsEnabled ? (
        <form className="space-y-4" onSubmit={submitCredentials}>
          <p className="text-sm leading-6 text-slate-400">
            Use the local development credentials configured for this app.
          </p>
          <label className="block">
            <span className="text-sm font-medium text-slate-200">Email</span>
            <input
              autoComplete="email"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-200">Password</span>
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button
            className="w-full rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in…" : "Sign in for development"}
          </button>
        </form>
      ) : null}

      {error ? (
        <p aria-live="assertive" className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
