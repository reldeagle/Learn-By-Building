import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ withAuth: vi.fn(() => vi.fn()) }));

vi.mock("next-auth/middleware", () => ({ withAuth: mocks.withAuth }));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("auth proxy", () => {
  it("protects learner routes with the local custom session cookie", async () => {
    const { config, default: proxy } = await import("./proxy");

    expect(mocks.withAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        cookies: {
          sessionToken: { name: "learn-by-building.session-token" },
        },
        pages: { signIn: "/signin" },
      }),
    );
    expect(proxy).toBeTypeOf("function");
    expect(config.matcher).toEqual(["/start", "/project/:path*", "/track"]);
  });

  it("uses the secure session cookie for an HTTPS deployment", async () => {
    vi.stubEnv("NEXTAUTH_URL", "https://learn.example.com");

    await import("./proxy");

    expect(mocks.withAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        cookies: {
          sessionToken: { name: "__Secure-learn-by-building.session-token" },
        },
      }),
    );
  });
});
