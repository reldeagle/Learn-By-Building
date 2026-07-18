import Link from "next/link";

import { AccountMenu } from "@/components/account-menu";
import { getSignInUrl } from "@/lib/auth-redirect";

export function AppShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email?: string | null;
}) {
  return (
    <div className="min-h-full flex flex-1 flex-col bg-slate-950">
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <Link
            className="inline-flex items-center gap-2 rounded-lg font-semibold tracking-tight text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            href="/"
          >
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-lg bg-cyan-300 text-xs font-bold text-slate-950"
            >
              LB
            </span>
            Learn By Building
          </Link>
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-2 sm:gap-3"
          >
            {email ? (
              <>
                <Link
                  className="rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  href="/track"
                >
                  Your track
                </Link>
                <AccountMenu email={email} />
              </>
            ) : (
              <Link
                className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-cyan-300 transition hover:border-cyan-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                href={getSignInUrl("/")}
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
