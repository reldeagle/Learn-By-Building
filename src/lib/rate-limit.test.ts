import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/data/client", () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));

import { enforceRateLimit, RateLimitError } from "./rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
});

it("blocks the request after the shared per-user limit", async () => {
  mocks.queryRaw.mockResolvedValueOnce([{ count: 5 }]);
  await expect(enforceRateLimit("user-1", "generation")).resolves.toBe(
    undefined,
  );

  mocks.queryRaw.mockResolvedValueOnce([{ count: 6 }]);
  await expect(enforceRateLimit("user-1", "generation")).rejects.toThrow(
    RateLimitError,
  );
  expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
});
