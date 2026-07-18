import { z } from "zod";

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    LLM_PROVIDER: z.enum(["google-ai-studio", "fake"]),
    GOOGLE_AI_STUDIO_API_KEY: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (
      env.LLM_PROVIDER === "google-ai-studio" &&
      !env.GOOGLE_AI_STUDIO_API_KEY
    ) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_AI_STUDIO_API_KEY"],
        message:
          "GOOGLE_AI_STUDIO_API_KEY is required when LLM_PROVIDER is google-ai-studio",
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export function getConfig(): AppConfig {
  const result = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    GOOGLE_AI_STUDIO_API_KEY: process.env.GOOGLE_AI_STUDIO_API_KEY,
  });

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new ConfigurationError(
      `Invalid environment configuration: ${details}`,
    );
  }

  return result.data;
}
