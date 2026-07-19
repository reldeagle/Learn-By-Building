"use client";

import { RouteError } from "@/components/route-state";

export default function NotFound() {
  return (
    <RouteError
      description="This page does not exist, or it is no longer available to your account."
      reset={() => {}}
      returnHref="/"
      returnLabel="Return home"
      title="Page not found"
    />
  );
}
