import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWithFirstProject: vi.fn(),
  createProject: vi.fn(),
  createProvider: vi.fn(),
  enforceRateLimit: vi.fn(),
  generateProject: vi.fn(),
  getActive: vi.fn(),
  getByIdForUser: vi.fn(),
  getCompletedTitles: vi.fn(),
  getCurrentLevel: vi.fn(),
  getNextOrder: vi.fn(),
  nextHint: vi.fn(),
  recordUnlock: vi.fn(),
  requireUser: vi.fn(),
  setLearnerFeedbackForUser: vi.fn(),
}));

vi.mock("@/ai/provider", () => ({
  createLLMProvider: mocks.createProvider,
}));
vi.mock("@/data/repositories", () => ({
  HintRepository: class {
    getCurrentLevel(...args: unknown[]) {
      return mocks.getCurrentLevel(...args);
    }

    recordUnlock(...args: unknown[]) {
      return mocks.recordUnlock(...args);
    }
  },
  ProjectRepository: class {
    create(...args: unknown[]) {
      return mocks.createProject(...args);
    }

    getActive(...args: unknown[]) {
      return mocks.getActive(...args);
    }

    getByIdForUser(...args: unknown[]) {
      return mocks.getByIdForUser(...args);
    }

    getCompletedTitles(...args: unknown[]) {
      return mocks.getCompletedTitles(...args);
    }

    getNextOrder(...args: unknown[]) {
      return mocks.getNextOrder(...args);
    }
  },
  ReviewRepository: class {
    setLearnerFeedbackForUser(...args: unknown[]) {
      return mocks.setLearnerFeedbackForUser(...args);
    }
  },
  TrackRepository: class {
    createWithFirstProject(...args: unknown[]) {
      return mocks.createWithFirstProject(...args);
    }

    getByIdForUser(...args: unknown[]) {
      return mocks.getByIdForUser(...args);
    }
  },
}));
vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  RateLimitError: class RateLimitError extends Error {},
}));
vi.mock("@/modules/hint-system", () => ({ nextHint: mocks.nextHint }));
vi.mock("@/modules/project-generator", () => ({
  generateProject: mocks.generateProject,
}));

import {
  requestHint,
  requestNextProject,
  startTrack,
  submitReviewFeedback,
} from "./learning";

const project = {
  title: "Counter app",
  goal: "Build a counter with three controls.",
  requirements: ["Increment the count", "Reset the count"],
  expectedOutcome: "The count updates when a control is clicked.",
  hints: [
    { level: 1, text: "Start with useState.", isSolution: false },
    { level: 2, text: "Use useState for the count value.", isSolution: true },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({
    id: "user-1",
    email: "learner@example.com",
  });
  mocks.createProvider.mockReturnValue({});
  mocks.generateProject.mockResolvedValue(project);
});

describe("startTrack", () => {
  it("creates a track with its first generated project", async () => {
    mocks.createWithFirstProject.mockResolvedValue({
      id: "track-1",
      projects: [{ id: "project-1" }],
    });

    const result = await startTrack({
      technology: "react",
      jsExperience: "I have built a small JavaScript app.",
      level: "beginner",
    });

    expect(result.project).toEqual({ id: "project-1" });
    expect(mocks.generateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        jsExperience: "I have built a small JavaScript app.",
      }),
      expect.anything(),
    );
    expect(mocks.createWithFirstProject).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        currentLevel: 1,
        technology: "react",
      }),
    );
  });
});

describe("requestNextProject", () => {
  it("generates and persists the next project after completion", async () => {
    mocks.getByIdForUser.mockResolvedValue({
      id: "track-1",
      technology: "react",
      currentLevel: 2,
    });
    mocks.getActive.mockResolvedValue(null);
    mocks.getCompletedTitles.mockResolvedValue([{ title: "Counter app" }]);
    mocks.getNextOrder.mockResolvedValue(2);
    mocks.createProject.mockResolvedValue({ id: "project-2" });

    await expect(
      requestNextProject("ckv8fth7w0000l08l4v1l7q4v"),
    ).resolves.toEqual({
      id: "project-2",
    });
    expect(mocks.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ trackId: "track-1", order: 2, difficulty: 2 }),
    );
  });

  it("does not access a track owned by another user", async () => {
    mocks.getByIdForUser.mockResolvedValue(null);

    await expect(
      requestNextProject("ckv8fth7w0000l08l4v1l7q4v"),
    ).rejects.toThrow("Track not found.");
  });
});

describe("requestHint", () => {
  it("returns and records the next hint for an owned project", async () => {
    mocks.getByIdForUser.mockResolvedValue({
      id: "project-1",
      title: project.title,
      goal: project.goal,
      expectedOutcome: project.expectedOutcome,
      hints: project.hints,
      requirements: project.requirements.map((text) => ({ text })),
    });
    mocks.getCurrentLevel.mockResolvedValue(0);
    mocks.nextHint.mockReturnValue(project.hints[0]);

    await expect(requestHint("ckv8fth7w0000l08l4v1l7q4v")).resolves.toEqual(
      project.hints[0],
    );
    expect(mocks.recordUnlock).toHaveBeenCalledWith("project-1", 1);
  });

  it("does not reveal hints for another user's project", async () => {
    mocks.getByIdForUser.mockResolvedValue(null);

    await expect(requestHint("ckv8fth7w0000l08l4v1l7q4v")).rejects.toThrow(
      "Project not found.",
    );
  });
});

describe("submitReviewFeedback", () => {
  it("persists a thumbs-up rating for an owned review", async () => {
    mocks.setLearnerFeedbackForUser.mockResolvedValue(true);

    await expect(
      submitReviewFeedback({
        reviewId: "ckv8fth7w0000l08l4v1l7q4v",
        rating: "thumbs_up",
      }),
    ).resolves.toEqual({ rating: "thumbs_up" });
    expect(mocks.setLearnerFeedbackForUser).toHaveBeenCalledWith({
      reviewId: "ckv8fth7w0000l08l4v1l7q4v",
      userId: "user-1",
      rating: "thumbs_up",
    });
  });

  it("does not save feedback for another user's review", async () => {
    mocks.setLearnerFeedbackForUser.mockResolvedValue(false);

    await expect(
      submitReviewFeedback({
        reviewId: "ckv8fth7w0000l08l4v1l7q4v",
        rating: "thumbs_down",
      }),
    ).rejects.toThrow("Review not found.");
  });
});
