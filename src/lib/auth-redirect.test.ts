import { describe, expect, it } from "vitest";

import { getSafeCallbackPath, getSignInUrl } from "./auth-redirect";

describe("auth redirects", () => {
  it("keeps internal callback paths", () => {
    expect(getSafeCallbackPath("/project/project-1?submit=1")).toBe(
      "/project/project-1?submit=1",
    );
  });

  it("falls back to the track for unsafe callback paths", () => {
    expect(getSafeCallbackPath("https://example.com")).toBe("/track");
    expect(getSafeCallbackPath("//example.com")).toBe("/track");
    expect(getSafeCallbackPath("/\\example.com")).toBe("/track");
  });

  it("encodes the safe callback path for the sign-in screen", () => {
    expect(getSignInUrl("/project/project-1/review")).toBe(
      "/signin?callbackUrl=%2Fproject%2Fproject-1%2Freview",
    );
  });
});
