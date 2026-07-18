import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeProvider } from "@/ai/fake-provider";

const projectId = "ckv8fth7w0000l08l4v1l7q4v";
const trackId = "ckv8fth7w0001l08l4v1l7q4v";

const firstProject = {
  title: "Counter app",
  goal: "Build a counter with three controls.",
  requirements: ["Increment the count"],
  expectedOutcome: "The count increments when the button is clicked.",
  hints: [
    { level: 1, text: "Start with useState.", isSolution: false },
    { level: 2, text: "Use useState for the count value.", isSolution: true },
  ],
};

const review = {
  requirementStatus: [
    {
      requirementIndex: 0,
      met: true,
      reason: "The click handler updates state.",
    },
  ],
  feedback: [],
};

const nextProject = {
  ...firstProject,
  title: "Todo list",
  goal: "Build a todo list.",
};

const state = {
  currentLevel: 1,
  projectStatus: "active" as "active" | "completed",
  savedReview: false,
};

const mocks = vi.hoisted(() => ({
  createProvider: vi.fn(),
  enforceRateLimit: vi.fn(),
  logEvent: vi.fn(),
  requireUser: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

vi.mock("@/ai/provider", () => ({
  createLLMProvider: mocks.createProvider,
}));
vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
  UnauthorizedError: mocks.UnauthorizedError,
}));
vi.mock("@/lib/logger", () => ({
  createRequestLogContext: vi.fn((operation: string) => ({
    operation,
    requestId: "request-1",
  })),
  logEvent: mocks.logEvent,
  withRequestLogContext: <T>(_context: unknown, callback: () => T) =>
    callback(),
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  RateLimitError: class RateLimitError extends Error {},
}));
vi.mock("@/data/repositories", () => ({
  TrackRepository: class {
    createWithFirstProject() {
      return Promise.resolve({ id: trackId, projects: [{ id: projectId }] });
    }

    getByIdForUser() {
      return Promise.resolve({
        id: trackId,
        technology: "react",
        currentLevel: state.currentLevel,
      });
    }

    getByUserAndTechnology() {
      return Promise.resolve(null);
    }

    updateLevel(_id: string, level: number) {
      state.currentLevel = level;
      return Promise.resolve({});
    }
  },
  ProjectRepository: class {
    create() {
      return Promise.resolve({ id: "ckv8fth7w0002l08l4v1l7q4v" });
    }

    getActive() {
      return Promise.resolve(
        state.projectStatus === "active" ? { id: projectId } : null,
      );
    }

    getByIdForUser() {
      return Promise.resolve({
        id: projectId,
        title: firstProject.title,
        goal: firstProject.goal,
        expectedOutcome: firstProject.expectedOutcome,
        hints: firstProject.hints,
        requirements: firstProject.requirements.map((text) => ({ text })),
        track: { id: trackId, currentLevel: state.currentLevel },
        status: state.projectStatus,
      });
    }

    getCompletedTitles() {
      return Promise.resolve([{ title: firstProject.title }]);
    }

    getNextOrder() {
      return Promise.resolve(2);
    }

    markComplete() {
      state.projectStatus = "completed";
      return Promise.resolve({});
    }

    updateRequirementStatus() {
      return Promise.resolve([]);
    }
  },
  ReviewRepository: class {
    saveReviewAndUpdateProject({
      difficultyDelta,
    }: {
      difficultyDelta: 0 | 1;
    }) {
      state.savedReview = true;
      state.projectStatus = "completed";
      state.currentLevel += difficultyDelta;
      return Promise.resolve({ id: "ckv8fth7w0003l08l4v1l7q4v" });
    }
  },
  SubmissionRepository: class {
    saveSubmission() {
      return Promise.resolve({ id: "ckv8fth7w0004l08l4v1l7q4v" });
    }
  },
}));

import { requestNextProject, startTrack } from "./actions/learning";
import { POST } from "./api/review/route";

beforeEach(() => {
  vi.clearAllMocks();
  state.currentLevel = 1;
  state.projectStatus = "active";
  state.savedReview = false;
  mocks.requireUser.mockResolvedValue({ id: "user-1" });
  mocks.createProvider
    .mockReturnValueOnce(new FakeProvider(firstProject))
    .mockReturnValueOnce(new FakeProvider(review))
    .mockReturnValueOnce(new FakeProvider(nextProject));
});

describe("core learner loop", () => {
  it("starts a track, completes a review, and unlocks the next project", async () => {
    const started = await startTrack({
      technology: "react",
      jsExperience: "I have built a small JavaScript app.",
      level: "beginner",
    });

    expect(started).toMatchObject({
      projectId,
      status: "created",
      trackId,
    });

    const response = await POST(
      new Request("http://localhost/api/review", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          submission: { code: "export default function App() {}" },
        }),
      }),
    );

    await expect(response.text()).resolves.toContain('"verdict":"complete"');
    expect(state.savedReview).toBe(true);
    expect(state.currentLevel).toBe(2);

    await expect(requestNextProject(trackId)).resolves.toEqual({
      id: "ckv8fth7w0002l08l4v1l7q4v",
    });
  });
});
