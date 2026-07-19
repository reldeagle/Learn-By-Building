import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ withAuth: vi.fn(() => vi.fn()) }));

vi.mock("next-auth/middleware", () => ({ withAuth: mocks.withAuth }));

import proxy, { config } from "./proxy";

describe("auth proxy", () => {
  it("protects learner routes with the custom sign-in page", () => {
    expect(mocks.withAuth).toHaveBeenCalledWith({
      pages: { signIn: "/signin" },
    });
    expect(proxy).toBeTypeOf("function");
    expect(config.matcher).toEqual(["/start", "/project/:path*", "/track"]);
  });
});
