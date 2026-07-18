import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIServiceError } from "@/ai/llm-provider";

const mocks = vi.hoisted(() => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  createProvider: vi.fn(),
  enforceRateLimit: vi.fn(),
  evaluateProgress: vi.fn(),
  getByIdForUser: vi.fn(),
  requireUser: vi.fn(),
  reviewSubmission: vi.fn(),
  saveReviewAndUpdateProject: vi.fn(),
  saveSubmission: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("@/ai/provider", () => ({
  createLLMProvider: mocks.createProvider,
}));
vi.mock("@/data/repositories", () => ({
  ProjectRepository: class {
    getByIdForUser(...args: unknown[]) {
      return mocks.getByIdForUser(...args);
    }
  },
  ReviewRepository: class {
    saveReviewAndUpdateProject(...args: unknown[]) {
      return mocks.saveReviewAndUpdateProject(...args);
    }
  },
  SubmissionRepository: class {
    saveSubmission(...args: unknown[]) {
      return mocks.saveSubmission(...args);
    }
  },
}));
vi.mock("@/lib/auth", () => {
  return {
    requireUser: mocks.requireUser,
    UnauthorizedError: mocks.UnauthorizedError,
  };
});
vi.mock("@/lib/rate-limit", () => {
  class RateLimitError extends Error {}

  return { enforceRateLimit: mocks.enforceRateLimit, RateLimitError };
});
vi.mock("@/lib/logger", () => ({
  createRequestLogContext: vi.fn((operation: string) => ({
    operation,
    requestId: "request-1",
  })),
  logEvent: mocks.logEvent,
  withRequestLogContext: <T>(_context: unknown, callback: () => T) =>
    callback(),
}));
vi.mock("@/modules/code-review", () => ({
  reviewSubmission: mocks.reviewSubmission,
}));
vi.mock("@/modules/progression", () => ({
  evaluateProgress: mocks.evaluateProgress,
}));

import { POST } from "./route";

const projectId = "ckv8fth7w0000l08l4v1l7q4v";
const review = {
  verdict: "complete" as const,
  requirementStatus: [
    {
      requirement: "Increment the count",
      met: true,
      reason: "Implemented.",
    },
  ],
  feedback: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "user-1" });
  mocks.getByIdForUser.mockResolvedValue({
    id: "project-1",
    title: "Counter app",
    goal: "Build a counter.",
    expectedOutcome: "A working counter.",
    hints: [],
    requirements: [{ text: "Increment the count" }],
    track: { id: "track-1", currentLevel: 1 },
    status: "active",
  });
  mocks.saveSubmission.mockResolvedValue({ id: "submission-1" });
  mocks.saveReviewAndUpdateProject.mockResolvedValue({ id: "review-1" });
  mocks.createProvider.mockReturnValue({});
  mocks.reviewSubmission.mockResolvedValue(review);
  mocks.evaluateProgress.mockReturnValue({
    action: "unlock_next",
    difficultyDelta: 1,
  });
});

describe("POST /api/review", () => {
  it("reports local progress and persists the completed review", async () => {
    const response = await POST(
      new Request("http://localhost/api/review", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          code: "export default function App() {}",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    await expect(response.text()).resolves.toContain("event: progress");
    expect(mocks.saveReviewAndUpdateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: "submission-1",
        projectId: "project-1",
        trackId: "track-1",
        difficultyDelta: 1,
      }),
    );
    expect(mocks.logEvent).toHaveBeenCalledWith(
      "request.complete",
      expect.objectContaining({ operation: "review", verdict: "complete" }),
    );
  });

  it("rejects a project that is not owned by the session user", async () => {
    mocks.getByIdForUser.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/review", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          code: "export default function App() {}",
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(mocks.saveSubmission).not.toHaveBeenCalled();
    expect(mocks.logEvent).toHaveBeenCalledWith(
      "request.rejected",
      expect.objectContaining({ code: "not_found" }),
    );
  });

  it("rejects a project that has already been completed", async () => {
    mocks.getByIdForUser.mockResolvedValue({
      id: "project-1",
      status: "completed",
    });

    const response = await POST(
      new Request("http://localhost/api/review", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          code: "export default function App() {}",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.saveSubmission).not.toHaveBeenCalled();
  });

  it("rejects an oversized request before parsing it", async () => {
    const response = await POST(
      new Request("http://localhost/api/review", {
        method: "POST",
        headers: { "content-length": "404097" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(413);
    expect(mocks.saveSubmission).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request", async () => {
    mocks.requireUser.mockRejectedValue(new mocks.UnauthorizedError());

    const response = await POST(
      new Request("http://localhost/api/review", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          code: "export default function App() {}",
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns a safe retryable stream error when review fails", async () => {
    mocks.reviewSubmission.mockRejectedValue(
      new AIServiceError("provider secret detail", true),
    );

    const response = await POST(
      new Request("http://localhost/api/review", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          code: "export default function App() {}",
        }),
      }),
    );

    await expect(response.text()).resolves.toContain(
      "Your mentor is unavailable right now. Please try again.",
    );
    expect(mocks.logEvent).toHaveBeenCalledWith(
      "request.error",
      expect.objectContaining({
        operation: "review",
        code: "ai_unavailable",
      }),
    );
    expect(mocks.saveSubmission).not.toHaveBeenCalled();
  });
});
