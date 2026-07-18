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
});
