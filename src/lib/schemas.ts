import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);

export const MAX_SUBMISSION_CHARACTERS = 100_000;

export const HintSchema = z
  .object({
    level: z.number().int().min(1),
    text: nonEmptyText,
    isSolution: z.boolean(),
  })
  .strict();

export const ProjectSchema = z
  .object({
    title: nonEmptyText,
    goal: nonEmptyText,
    requirements: z.array(nonEmptyText).min(1),
    expectedOutcome: nonEmptyText,
    hints: z.array(HintSchema),
  })
  .strict()
  .superRefine((project, context) => {
    if (!project.hints.length) {
      return;
    }

    const hints = [...project.hints].sort((a, b) => a.level - b.level);
    const finalHint = hints.at(-1);

    if (!finalHint?.isSolution) {
      context.addIssue({
        code: "custom",
        message: "Hints must end with a solution hint.",
        path: ["hints"],
      });
    }

    for (const [index, hint] of hints.entries()) {
      if (hint.level !== index + 1) {
        context.addIssue({
          code: "custom",
          message: "Hint levels must be consecutive starting at one.",
          path: ["hints", index, "level"],
        });
      }
    }
  });

const FeedbackSchema = z
  .object({
    issue: nonEmptyText,
    why: nonEmptyText,
    priority: z.enum(["high", "medium", "low"]),
  })
  .strict();

const RequirementEvaluationSchema = z
  .object({
    requirementIndex: z.number().int().nonnegative(),
    met: z.boolean(),
    reason: nonEmptyText,
  })
  .strict();

export const ReviewSchema = z
  .object({
    verdict: z.enum(["complete", "needs_work"]),
    requirementStatus: z
      .array(
        z
          .object({
            requirement: nonEmptyText,
            met: z.boolean(),
            reason: nonEmptyText,
          })
          .strict(),
      )
      .min(1),
    feedback: z.array(FeedbackSchema),
  })
  .strict();

export const ReviewEvaluationSchema = z
  .object({
    requirementStatus: z.array(RequirementEvaluationSchema).min(1),
    feedback: z.array(FeedbackSchema),
  })
  .strict();

export function createReviewEvaluationSchema(requirementCount: number) {
  return ReviewEvaluationSchema.superRefine((review, context) => {
    if (review.requirementStatus.length !== requirementCount) {
      context.addIssue({
        code: "custom",
        message: "Every project requirement must be evaluated exactly once.",
        path: ["requirementStatus"],
      });
      return;
    }

    const indexes = new Set(
      review.requirementStatus.map((item) => item.requirementIndex),
    );

    if (
      indexes.size !== requirementCount ||
      [...indexes].some((index) => index >= requirementCount)
    ) {
      context.addIssue({
        code: "custom",
        message: "Requirement indexes must match the project requirements.",
        path: ["requirementStatus"],
      });
    }
  });
}

export const LearnerContextSchema = z
  .object({
    technology: z.literal("react"),
    currentLevel: z.number().int().min(1),
    completedProjects: z.array(nonEmptyText),
    jsExperience: nonEmptyText.optional(),
  })
  .strict();

export const StartTrackInputSchema = z
  .object({
    technology: z.literal("react"),
    jsExperience: nonEmptyText.max(1000),
    level: z.enum(["beginner", "intermediate", "experienced"]),
  })
  .strict();

export const RequestHintInputSchema = z
  .object({
    projectId: z.string().cuid(),
  })
  .strict();

export const RequestNextProjectInputSchema = z
  .object({
    trackId: z.string().cuid(),
  })
  .strict();

export const ReviewRequestSchema = z
  .object({
    projectId: z.string().cuid(),
    code: z.string().min(1).max(MAX_SUBMISSION_CHARACTERS),
  })
  .strict();

export const ReviewFeedbackInputSchema = z
  .object({
    reviewId: z.string().cuid(),
    rating: z.enum(["thumbs_up", "thumbs_down"]),
  })
  .strict();

export type Hint = z.infer<typeof HintSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type ReviewEvaluation = z.infer<typeof ReviewEvaluationSchema>;
export type LearnerContext = z.infer<typeof LearnerContextSchema>;
export type StartTrackInput = z.infer<typeof StartTrackInputSchema>;
export type RequestHintInput = z.infer<typeof RequestHintInputSchema>;
export type RequestNextProjectInput = z.infer<
  typeof RequestNextProjectInputSchema
>;
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;
export type ReviewFeedbackInput = z.infer<typeof ReviewFeedbackInputSchema>;
