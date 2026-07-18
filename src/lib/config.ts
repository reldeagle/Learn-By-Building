import { z } from "zod";

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

type Environment = Record<string, string | undefined>;

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  GOOGLE_AI_STUDIO_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  LLM_PROVIDER: z.enum(["google-ai-studio", "fake"]),
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
});

const configSchema = environmentSchema.superRefine((env, context) => {
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

export type AppConfig = z.infer<typeof configSchema>;

function detailsFor(result: z.ZodSafeParseError<unknown>) {
  return result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

function readEnvironment(env: Environment) {
  return {
    DATABASE_URL: env.DATABASE_URL,
    GOOGLE_AI_STUDIO_API_KEY: env.GOOGLE_AI_STUDIO_API_KEY,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    LLM_PROVIDER: env.LLM_PROVIDER,
    NEXTAUTH_SECRET: env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: env.NEXTAUTH_URL,
  };
}

export function getConfig(env: Environment = process.env): AppConfig {
  const result = configSchema.safeParse(readEnvironment(env));

  if (!result.success) {
    throw new ConfigurationError(
      `Invalid environment configuration: ${detailsFor(result)}`,
    );
  }

  return result.data;
}

export function validateProductionConfig(env: Environment = process.env) {
  const config = getConfig(env);
  const issues: string[] = [];
  let databaseUrl: URL | null = null;

  try {
    databaseUrl = new URL(config.DATABASE_URL);
  } catch {
    issues.push("DATABASE_URL: must be a valid PostgreSQL connection URL");
  }

  if (
    databaseUrl &&
    databaseUrl.protocol !== "postgres:" &&
    databaseUrl.protocol !== "postgresql:"
  ) {
    issues.push("DATABASE_URL: must use the postgres or postgresql protocol");
  }

  if (databaseUrl?.hostname.endsWith(".neon.tech")) {
    if (!databaseUrl.hostname.includes("-pooler.")) {
      issues.push(
        "DATABASE_URL: use Neon's pooled hostname ending in -pooler for production runtime traffic",
      );
    }

    if (databaseUrl.searchParams.get("sslmode") !== "require") {
      issues.push("DATABASE_URL: require sslmode=require for Neon");
    }
  }

  if (!config.NEXTAUTH_URL?.startsWith("https://")) {
    issues.push("NEXTAUTH_URL: must be an HTTPS URL in production");
  }

  if (!config.NEXTAUTH_SECRET || config.NEXTAUTH_SECRET.length < 32) {
    issues.push("NEXTAUTH_SECRET: provide at least 32 random characters");
  }

  if (!config.GOOGLE_CLIENT_ID) {
    issues.push("GOOGLE_CLIENT_ID: is required for production sign-in");
  }

  if (!config.GOOGLE_CLIENT_SECRET) {
    issues.push("GOOGLE_CLIENT_SECRET: is required for production sign-in");
  }

  if (issues.length) {
    console.error(
      JSON.stringify({
        event: "config.invalid",
        environment: env.VERCEL_ENV ?? "production",
        issues,
      }),
    );
    throw new ConfigurationError(
      `Invalid production configuration: ${issues.join("; ")}`,
    );
  }

  console.info(
    JSON.stringify({
      event: "config.valid",
      environment: env.VERCEL_ENV ?? "production",
      provider: config.LLM_PROVIDER,
      database: databaseUrl?.hostname.endsWith(".neon.tech")
        ? "neon-pooled"
        : "postgres",
    }),
  );

  return config;
}
