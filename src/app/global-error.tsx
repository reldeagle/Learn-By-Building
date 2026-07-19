"use client";

import { RouteError } from "@/components/route-state";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-full bg-slate-950">
        <RouteError
          description="A critical page error occurred. Try again or return home."
          reset={reset}
          returnHref="/"
          returnLabel="Return home"
          title="We could not load the app"
        />
      </body>
    </html>
  );
}
