import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRequestLogContext,
  logEvent,
  withRequestLogContext,
} from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("request logging", () => {
  it("adds a request ID without overwriting the event operation", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const context = createRequestLogContext("review");

    withRequestLogContext(context, () => {
      logEvent("ai.call", { operation: "complete" });
    });

    expect(JSON.parse(info.mock.calls[0]?.[0] as string)).toMatchObject({
      event: "ai.call",
      operation: "complete",
      requestId: context.requestId,
      requestOperation: "review",
    });
  });

  it("redacts learner code and credentials from structured logs", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logEvent("request.complete", {
      code: "const learnerSubmission = 'private';",
      operation: "review",
      password: "not-a-real-password",
    });

    const message = info.mock.calls[0]?.[0];
    expect(message).toContain('"code":"[redacted]"');
    expect(message).toContain('"password":"[redacted]"');
    expect(message).not.toContain("learnerSubmission");
    expect(message).not.toContain("not-a-real-password");
  });
});
