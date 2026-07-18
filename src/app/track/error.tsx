"use client";

import { RouteError } from "@/components/route-state";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <RouteError
      description="We could not load your progress right now. Try again in a moment."
      reset={reset}
      returnHref="/"
      returnLabel="Return home"
      title="We could not open your track"
    />
  );
}
