"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export function AccountMenu({ email }: { email: string }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setError(null);
    setIsSigningOut(true);

    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("We could not sign you out. Please try again.");
      setIsSigningOut(false);
    }
  }

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-xl border border-slate-800 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-700 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
        Account
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-2xl shadow-slate-950/50">
        <p className="truncate px-2 py-1 text-sm text-slate-300">{email}</p>
        <button
          className="mt-2 w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
          type="button"
        >
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
        {error ? (
          <p className="mt-2 px-2 text-xs text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
