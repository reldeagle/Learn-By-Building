import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/auth", () => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock("@/lib/rate-limit", () => ({
  RateLimitError: class RateLimitError extends Error {},
}));

import { AIServiceError } from "@/ai/llm-provider";
import { ConfigurationError } from "@/lib/config";

import { toAppError } from "./app-error";

describe("toAppError", () => {
  it("keeps provider failures safe and retryable", () => {
    expect(
      toAppError(new AIServiceError("provider detail", true)),
    ).toMatchObject({
      code: "ai_unavailable",
      message: "Your mentor is unavailable right now. Please try again.",
      retryable: true,
      status: 503,
    });
  });

  it("classifies invalid input without exposing validation details", () => {
    const result = z.string().min(1).safeParse("");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toAppError(result.error)).toMatchObject({
        code: "invalid_request",
        message: "Please check your submission and try again.",
        status: 400,
      });
    }
  });

  it("hides configuration details from learners", () => {
    expect(
      toAppError(new ConfigurationError("GOOGLE_AI_STUDIO_API_KEY is missing")),
    ).toMatchObject({
      code: "configuration_error",
      message:
        "The service is not configured correctly. Please try again later.",
      retryable: true,
      status: 503,
    });
  });
});
