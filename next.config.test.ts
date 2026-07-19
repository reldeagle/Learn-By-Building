import { describe, expect, it } from "vitest";

import config from "./next.config";

describe("next configuration", () => {
  it("applies baseline security headers", async () => {
    const rules = await config.headers!();

    expect(config.poweredByHeader).toBe(false);
    expect(rules).toEqual([
      {
        source: "/:path*",
        headers: expect.arrayContaining([
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=()",
          },
        ]),
      },
    ]);
  });
});
