"use client";

import { RouteError } from "@/components/route-state";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <RouteError
      description="We could not load this review. Your submitted work has not been lost."
      reset={reset}
      returnHref="/track"
      returnLabel="Return to track"
      title="We could not open this review"
    />
  );
}
