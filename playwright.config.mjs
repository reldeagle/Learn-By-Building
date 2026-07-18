import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.SMOKE_BASE_URL,
    trace: "retain-on-failure",
  },
});
