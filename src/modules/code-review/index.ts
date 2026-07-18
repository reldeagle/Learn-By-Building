import type { CompletionRequest, LLMProvider } from "../../ai/llm-provider";
import { mentorSystemPrompt } from "../../ai/prompts/mentor-v1";
import {
  createReviewEvaluationSchema,
  type Project,
  type Review,
  type ReviewEvaluation,
} from "../../lib/schemas";

export function createReviewRequest(
  project: Project,
  code: string,
): CompletionRequest<ReviewEvaluation> {
  return {
    system: mentorSystemPrompt,
    messages: [
      {
        role: "user",
        content: [
          "Review this learner submission against every project requirement.",
          "Evaluate every requirement using its zero-based requirementIndex exactly once.",
          "Mark a requirement met only when the submission demonstrates it.",
          "Explain what to improve and why; do not rewrite the learner's code.",
          "Requirements:",
          ...project.requirements.map(
            (requirement, index) => `- [${index}] ${requirement}`,
          ),
          "Submission:",
          code,
        ].join("\n"),
      },
    ],
    schema: createReviewEvaluationSchema(project.requirements.length),
    maxTokens: 1_200,
    temperature: 0.2,
  };
}

export async function reviewSubmission(
  project: Project,
  code: string,
  provider: LLMProvider,
): Promise<Review> {
  const review = await provider.complete<ReviewEvaluation>(
    createReviewRequest(project, code),
  );

  const requirementStatus = review.requirementStatus
    .sort((left, right) => left.requirementIndex - right.requirementIndex)
    .map((status) => ({
      met: status.met,
      reason: status.reason,
      requirement: project.requirements[status.requirementIndex],
    }));

  return {
    feedback: review.feedback,
    requirementStatus,
    verdict: requirementStatus.every((status) => status.met)
      ? "complete"
      : "needs_work",
  };
}
