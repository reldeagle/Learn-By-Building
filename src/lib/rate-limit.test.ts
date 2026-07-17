import { expect, it } from "vitest";

import { enforceRateLimit, RateLimitError } from "./rate-limit";

it("blocks the request after the configured per-user limit", () => {
  const userId = `user-${Date.now()}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    expect(() => enforceRateLimit(userId, "generation")).not.toThrow();
  }

  expect(() => enforceRateLimit(userId, "generation")).toThrow(RateLimitError);
});
