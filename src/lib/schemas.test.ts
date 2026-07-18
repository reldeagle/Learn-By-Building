import { describe, expect, it } from "vitest";

import {
  HintSchema,
  LearnerContextSchema,
  MAX_SUBMISSION_CHARACTERS,
  ProjectSchema,
  RequestHintInputSchema,
  ReviewRequestSchema,
  ReviewSchema,
  StartTrackInputSchema,
} from "./schemas";

const projectId = "ckv8fth7w0000l08l4v1l7q4v";

describe("ProjectSchema", () => {
  it("parses a valid generated project", () => {
    const result = ProjectSchema.safeParse({
      title: "Counter app",
      goal: "Build a counter with three controls.",
      requirements: ["Increment the count", "Reset the count"],
      expectedOutcome: "The count changes when each control is clicked.",
      hints: [
        { level: 1, text: "Start with useState.", isSolution: false },
        {
          level: 2,
          text: "Use useState for the count value.",
          isSolution: true,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a project without requirements", () => {
    expect(
      ProjectSchema.safeParse({
        title: "Counter app",
        goal: "Build a counter.",
        requirements: [],
        expectedOutcome: "A working counter.",
        hints: [],
      }).success,
    ).toBe(false);
  });

  it("requires sequential hints that end with a solution", () => {
    expect(
      ProjectSchema.safeParse({
        title: "Counter app",
        goal: "Build a counter.",
        requirements: ["Increment the count"],
        expectedOutcome: "A working counter.",
        hints: [{ level: 1, text: "Start with useState.", isSolution: false }],
      }).success,
    ).toBe(false);
  });
});

describe("ReviewSchema", () => {
  it("parses a review with requirement-level feedback", () => {
    const result = ReviewSchema.safeParse({
      verdict: "needs_work",
      requirementStatus: [
        {
          requirement: "Increment the count",
          met: false,
          reason: "The button does not update state.",
        },
      ],
      feedback: [
        {
          issue: "The count is static.",
          why: "React only re-renders when state changes.",
          priority: "high",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown verdict", () => {
    expect(
      ReviewSchema.safeParse({
        verdict: "partial",
        requirementStatus: [],
        feedback: [],
      }).success,
    ).toBe(false);
  });
});

describe("LearnerContextSchema and HintSchema", () => {
  it("parses learner context and an escalating hint", () => {
    expect(
      LearnerContextSchema.safeParse({
        technology: "react",
        currentLevel: 1,
        completedProjects: ["Counter app"],
      }).success,
    ).toBe(true);
    expect(
      HintSchema.safeParse({
        level: 2,
        text: "Keep the count in component state.",
        isSolution: false,
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid hint level", () => {
    expect(
      HintSchema.safeParse({
        level: 0,
        text: "Try useState.",
        isSolution: false,
      }).success,
    ).toBe(false);
  });
});

describe("API input schemas", () => {
  it("parses valid inputs", () => {
    expect(
      StartTrackInputSchema.safeParse({
        technology: "react",
        jsExperience: "I have built a few small JavaScript projects.",
        level: "beginner",
      }).success,
    ).toBe(true);
    expect(RequestHintInputSchema.safeParse({ projectId }).success).toBe(true);
    expect(
      ReviewRequestSchema.safeParse({
        projectId,
        submission: { code: "export default {}" },
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported technology and empty submissions", () => {
    expect(
      StartTrackInputSchema.safeParse({
        technology: "vue",
        jsExperience: "Some experience",
        level: "beginner",
      }).success,
    ).toBe(false);
    expect(
      ReviewRequestSchema.safeParse({ projectId, submission: { code: "" } })
        .success,
    ).toBe(false);
    expect(
      ReviewRequestSchema.safeParse({
        projectId,
        submission: { code: "a".repeat(MAX_SUBMISSION_CHARACTERS + 1) },
      }).success,
    ).toBe(false);
  });
});
