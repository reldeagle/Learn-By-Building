import { describe, expect, it, vi } from "vitest";

import { FakeProvider } from "../ai/fake-provider";
import { ProjectSchema, type Review } from "../lib/schemas";
import { createReviewRequest, reviewSubmission } from "./code-review";
import { nextHint } from "./hint-system";
import { evaluateProgress } from "./progression";
import { generateProject } from "./project-generator";

const project = ProjectSchema.parse({
  title: "Counter app",
  goal: "Build a counter with three controls.",
  requirements: ["Increment the count", "Reset the count"],
  expectedOutcome: "The count updates when a control is clicked.",
  hints: [
    { level: 1, text: "Start with useState.", isSolution: false },
    { level: 2, text: "Write separate event handlers.", isSolution: false },
    { level: 3, text: "Connect each handler to a button.", isSolution: false },
    { level: 4, text: "Use useState and three buttons.", isSolution: true },
  ],
});

describe("generateProject", () => {
  it("returns a valid project from the provider", async () => {
    const result = await generateProject(
      {
        technology: "react",
        currentLevel: 1,
        completedProjects: [],
      },
      new FakeProvider(project),
    );

    expect(result).toEqual(project);
  });

  it("allocates enough output tokens for a complete project and hint set", async () => {
    const complete = vi.fn(async (request) => request.schema!.parse(project));

    await generateProject(
      { technology: "react", currentLevel: 1, completedProjects: [] },
      { complete, async *stream() {} },
    );

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 3_000 }),
    );
  });
});

describe("reviewSubmission", () => {
  it("allocates enough output tokens for requirement-level feedback", () => {
    expect(createReviewRequest(project, "export default function App() {}")).toMatchObject({
      maxTokens: 2_000,
    });
  });

  it("returns complete only when every requirement is met", async () => {
    const result = await reviewSubmission(
      project,
      "export default function Counter() {}",
      new FakeProvider({
        requirementStatus: project.requirements.map((_, requirementIndex) => ({
          requirementIndex,
          met: true,
          reason: "Implemented in the submission.",
        })),
        feedback: [],
      }),
    );

    expect(result.verdict).toBe("complete");
  });

  it("returns needs_work when a requirement is not met", async () => {
    const result = await reviewSubmission(
      project,
      "export default function Counter() {}",
      new FakeProvider({
        requirementStatus: [
          {
            requirementIndex: 0,
            met: true,
            reason: "Implemented in the submission.",
          },
          {
            requirementIndex: 1,
            met: false,
            reason: "No reset control is present.",
          },
        ],
        feedback: [
          {
            issue: "The reset control is missing.",
            why: "The user cannot return to the initial count.",
            priority: "high",
          },
        ],
      }),
    );

    expect(result.verdict).toBe("needs_work");
  });

  it("uses one structured completion and maps requirement indexes to project text", async () => {
    const complete = vi.fn(async (request) =>
      request.schema!.parse({
        requirementStatus: [
          {
            requirementIndex: 0,
            met: true,
            reason: "Implemented in the submission.",
          },
          {
            requirementIndex: 1,
            met: true,
            reason: "Implemented in the submission.",
          },
        ],
        feedback: [],
      }),
    );

    const result = await reviewSubmission(
      project,
      "export default function Counter() {}",
      {
        complete,
        async *stream() {},
      },
    );

    expect(complete).toHaveBeenCalledTimes(1);
    expect(
      result.requirementStatus.map((status) => status.requirement),
    ).toEqual(project.requirements);
  });
});

describe("nextHint", () => {
  it("reveals hints one level at a time, then the solution", () => {
    expect(nextHint(project, 0).level).toBe(1);
    expect(nextHint(project, 1).level).toBe(2);
    expect(nextHint(project, 2).level).toBe(3);
    expect(nextHint(project, 3).isSolution).toBe(true);
  });
});

describe("evaluateProgress", () => {
  const completeReview: Review = {
    verdict: "complete",
    requirementStatus: [
      {
        requirement: "Increment the count",
        met: true,
        reason: "Implemented in the submission.",
      },
    ],
    feedback: [],
  };

  it("advances after a complete review", () => {
    expect(evaluateProgress({ currentLevel: 1 }, completeReview)).toEqual({
      action: "unlock_next",
      difficultyDelta: 1,
    });
  });

  it("repeats the same level after needs_work", () => {
    expect(
      evaluateProgress(
        { currentLevel: 1 },
        { ...completeReview, verdict: "needs_work" },
      ),
    ).toEqual({ action: "repeat_same_level", difficultyDelta: 0 });
  });
});
