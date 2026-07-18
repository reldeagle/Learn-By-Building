"use client";

import { RouteError } from "@/components/route-state";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <RouteError
      description="Your saved learning data is safe. Try loading the setup again."
      reset={reset}
      returnHref="/"
      returnLabel="Return home"
      title="We could not open track setup"
    />
  );
}
