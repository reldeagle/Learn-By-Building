import { AIServiceError } from "@/ai/llm-provider";
import { UnauthorizedError } from "@/lib/auth";
import { RateLimitError } from "@/lib/rate-limit";

export type AppErrorCode =
  | "ai_unavailable"
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "unauthorized"
  | "unexpected";

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toAppError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof AIServiceError) {
    return new AppError(
      "ai_unavailable",
      "Your mentor is unavailable right now. Please try again.",
      503,
      true,
    );
  }

  if (error instanceof RateLimitError) {
    return new AppError("rate_limited", error.message, 429, true);
  }

  if (error instanceof UnauthorizedError) {
    return new AppError("unauthorized", "Authentication is required.", 401);
  }

  return new AppError(
    "unexpected",
    "Something went wrong. Please try again.",
    500,
    true,
  );
}
