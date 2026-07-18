import { Prisma } from "@/generated/prisma/client";
import { AIServiceError } from "@/ai/llm-provider";
import { UnauthorizedError } from "@/lib/auth";
import { ConfigurationError } from "@/lib/config";
import { RateLimitError } from "@/lib/rate-limit";
import { ZodError } from "zod";

export type AppErrorCode =
  | "ai_unavailable"
  | "configuration_error"
  | "database_unavailable"
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

  if (error instanceof ConfigurationError) {
    return new AppError(
      "configuration_error",
      "The service is not configured correctly. Please try again later.",
      503,
      true,
    );
  }

  if (error instanceof ZodError) {
    return new AppError(
      "invalid_request",
      "Please check your submission and try again.",
      400,
    );
  }

  if (error instanceof RateLimitError) {
    return new AppError("rate_limited", error.message, 429, true);
  }

  if (error instanceof UnauthorizedError) {
    return new AppError("unauthorized", "Authentication is required.", 401);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return new AppError(
        "invalid_request",
        "This action conflicts with existing progress.",
        409,
      );
    }

    return new AppError(
      "database_unavailable",
      "We could not reach your learning data. Please try again.",
      503,
      true,
    );
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return new AppError(
      "database_unavailable",
      "We could not reach your learning data. Please try again.",
      503,
      true,
    );
  }

  return new AppError(
    "unexpected",
    "Something went wrong. Please try again.",
    500,
    true,
  );
}
