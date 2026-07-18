"use client";

import { RouteError } from "@/components/route-state";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <RouteError
      description="We could not load this project. Try again or return to your track."
      reset={reset}
      returnHref="/track"
      returnLabel="Return to track"
      title="We could not open this project"
    />
  );
}
