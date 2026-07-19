import { describe, expect, it, vi } from "vitest";

import {
  ConfigurationError,
  getConfig,
  validateProductionConfig,
} from "./config";

const productionEnvironment = {
  DATABASE_URL:
    "postgresql://user:password@ep-test-pooler.us-west-2.aws.neon.tech/db?sslmode=require",
  GOOGLE_AI_STUDIO_API_KEY: "api-key",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  LLM_PROVIDER: "google-ai-studio",
  NEXTAUTH_SECRET: "a".repeat(32),
  NEXTAUTH_URL: "https://learn.example.com",
};

describe("configuration", () => {
  it("requires the provider key for Google AI Studio", () => {
    expect(() =>
      getConfig({
        DATABASE_URL: "postgresql://user:password@host/db",
        LLM_PROVIDER: "google-ai-studio",
      }),
    ).toThrow(ConfigurationError);
  });

  it("allows an optional model override while leaving the default unset", () => {
    expect(
      getConfig({
        DATABASE_URL: "postgresql://user:password@host/db",
        LLM_MODEL: "gemini-2.5-flash-lite",
        LLM_PROVIDER: "fake",
      }).LLM_MODEL,
    ).toBe("gemini-2.5-flash-lite");

    expect(
      getConfig({
        DATABASE_URL: "postgresql://user:password@host/db",
        LLM_PROVIDER: "fake",
      }).LLM_MODEL,
    ).toBeUndefined();
  });

  it("accepts a production-ready Neon configuration without logging secrets", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(validateProductionConfig(productionEnvironment)).toMatchObject({
      LLM_PROVIDER: "google-ai-studio",
    });
    expect(info).toHaveBeenCalledWith(
      expect.not.stringContaining(
        productionEnvironment.GOOGLE_AI_STUDIO_API_KEY,
      ),
    );
    info.mockRestore();
  });

  it("rejects a direct Neon endpoint in production", () => {
    expect(() =>
      validateProductionConfig({
        ...productionEnvironment,
        DATABASE_URL:
          "postgresql://user:password@ep-test.us-west-2.aws.neon.tech/db?sslmode=require",
      }),
    ).toThrow("pooled hostname");
  });
});
