import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/data/client", () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));
vi.mock("@/lib/config", () => ({ getConfig: mocks.getConfig }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getConfig.mockReturnValue({});
  mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
});

describe("GET /api/health", () => {
  it("reports healthy configuration and database checks", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      checks: { config: "ok", database: "ok" },
      status: "ok",
    });
  });

  it("reports a database failure without exposing the error", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("connection password invalid"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      checks: { config: "ok", database: "fail" },
      status: "unhealthy",
    });
  });

  it("reports a configuration failure without exposing details", async () => {
    mocks.getConfig.mockImplementation(() => {
      throw new Error("GOOGLE_AI_STUDIO_API_KEY=secret");
    });

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      checks: { config: "fail", database: "ok" },
      status: "unhealthy",
    });
  });
});
