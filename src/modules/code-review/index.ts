import type { CompletionRequest, LLMProvider } from "../../ai/llm-provider";
import { mentorSystemPrompt } from "../../ai/prompts/mentor-v1";
import { type Project, type Review, ReviewSchema } from "../../lib/schemas";

export function createReviewRequest(
  project: Project,
  code: string,
): CompletionRequest<Review> {
  return {
    system: mentorSystemPrompt,
    messages: [
      {
        role: "user",
        content: [
          "Review this learner submission against every project requirement.",
          "Use each requirement's exact text in requirementStatus.",
          "Mark a requirement met only when the submission demonstrates it.",
          "A project is complete only when every requirement is met.",
          "Explain what to improve and why; do not rewrite the learner's code.",
          "Requirements:",
          ...project.requirements.map((requirement) => `- ${requirement}`),
          "Submission:",
          code,
        ].join("\n"),
      },
    ],
    schema: ReviewSchema,
    maxTokens: 1_200,
    temperature: 0.2,
  };
}

export async function reviewSubmission(
  project: Project,
  code: string,
  provider: LLMProvider,
): Promise<Review> {
  const review = await provider.complete(createReviewRequest(project, code));

  const requirementStatus = project.requirements.map((requirement) => {
    const status = review.requirementStatus.find(
      (item) => item.requirement === requirement,
    );

    if (!status) {
      throw new Error("Review response did not evaluate every requirement.");
    }

    return status;
  });

  if (requirementStatus.length !== review.requirementStatus.length) {
    throw new Error("Review response included an unknown requirement.");
  }

  return {
    ...review,
    requirementStatus,
    verdict: requirementStatus.every((status) => status.met)
      ? "complete"
      : "needs_work",
  };
}
