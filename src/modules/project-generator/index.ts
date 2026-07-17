import type { LLMProvider } from "../../ai/llm-provider";
import { mentorSystemPrompt } from "../../ai/prompts/mentor-v1";
import {
  type LearnerContext,
  type Project,
  ProjectSchema,
} from "../../lib/schemas";

export function generateProject(
  context: LearnerContext,
  provider: LLMProvider,
): Promise<Project> {
  return provider.complete({
    system: mentorSystemPrompt,
    messages: [
      {
        role: "user",
        content: [
          "Generate a focused 15–30 minute project for this learner.",
          `Technology: ${context.technology}`,
          `Current level: ${context.currentLevel}`,
          `JavaScript experience: ${context.jsExperience ?? "not provided"}`,
          `Completed projects: ${context.completedProjects.join(", ") || "none"}`,
          "Include concrete, checkable requirements and progressive hints, ending with one solution hint marked isSolution: true.",
        ].join("\n"),
      },
    ],
    schema: ProjectSchema,
    maxTokens: 1_200,
    temperature: 0.4,
  });
}
