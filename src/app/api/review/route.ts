import {
  Prisma,
  ProjectStatus,
  ReviewVerdict,
} from "@/generated/prisma/client";
import { createLLMProvider } from "@/ai/provider";
import {
  ProjectRepository,
  ReviewRepository,
} from "@/data/repositories";
import { reviewSubmission } from "@/modules/code-review";
import { evaluateProgress } from "@/modules/progression";
import { AppError, toAppError } from "@/lib/app-error";
import { requireUser } from "@/lib/auth";
import {
  createRequestLogContext,
  logEvent,
  withRequestLogContext,
} from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ProjectSchema, ReviewRequestSchema } from "@/lib/schemas";
import {
  buildSubmissionCode,
  MAX_SUBMISSION_CHARACTERS,
  type SubmissionPayload,
} from "@/lib/submission-files";

const encoder = new TextEncoder();
const MAX_REVIEW_REQUEST_BYTES = MAX_SUBMISSION_CHARACTERS * 4 + 4_096;
const REVIEW_HEARTBEAT_MS = 10_000;

export const maxDuration = 60;

function event(name: string, data: unknown) {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

function toProjectDefinition(project: {
  title: string;
  goal: string;
  expectedOutcome: string;
  hints: unknown;
  requirements: Array<{ text: string }>;
}) {
  return ProjectSchema.parse({
    title: project.title,
    goal: project.goal,
    expectedOutcome: project.expectedOutcome,
    hints: project.hints,
    requirements: project.requirements.map((requirement) => requirement.text),
  });
}

function codeForSubmission(submission: SubmissionPayload) {
  return "files" in submission
    ? buildSubmissionCode(submission.files)
    : submission.code;
}

async function readRequestBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REVIEW_REQUEST_BYTES
  ) {
    return { body: null, tooLarge: true };
  }

  if (!request.body) {
    return { body: null, tooLarge: false };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      byteLength += value.byteLength;
      if (byteLength > MAX_REVIEW_REQUEST_BYTES) {
        await reader.cancel();
        return { body: null, tooLarge: true };
      }

      text += decoder.decode(value, { stream: true });
    }

    return { body: JSON.parse(text + decoder.decode()), tooLarge: false };
  } catch {
    return { body: null, tooLarge: false };
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const logContext = createRequestLogContext("review");

  return withRequestLogContext(logContext, async () => {
    const startedAt = Date.now();
    let userId: string | null = null;
    let projectId: string | null = null;

    try {
      const user = await requireUser();
      userId = user.id;
      const { body, tooLarge } = await readRequestBody(request);

      if (tooLarge) {
        logEvent("request.rejected", {
          operation: "review",
          userId,
          projectId,
          latencyMs: Date.now() - startedAt,
          code: "invalid_request",
        });
        return Response.json(
          { error: "Submission is too large." },
          { status: 413 },
        );
      }

      if (!body) {
        logEvent("request.rejected", {
          operation: "review",
          userId,
          projectId,
          latencyMs: Date.now() - startedAt,
          code: "invalid_request",
        });
        return Response.json({ error: "Invalid request." }, { status: 400 });
      }

      const input = ReviewRequestSchema.safeParse(body);

      if (!input.success) {
        logEvent("request.rejected", {
          operation: "review",
          userId,
          projectId,
          latencyMs: Date.now() - startedAt,
          code: "invalid_request",
        });
        return Response.json({ error: "Invalid request." }, { status: 400 });
      }
      projectId = input.data.projectId;

      const code = codeForSubmission(input.data.submission);

      const projects = new ProjectRepository();
      const project = await projects.getByIdForUser(
        input.data.projectId,
        user.id,
      );

      if (!project) {
        logEvent("request.rejected", {
          operation: "review",
          userId,
          projectId,
          latencyMs: Date.now() - startedAt,
          code: "not_found",
        });
        return Response.json({ error: "Project not found." }, { status: 404 });
      }

      if (project.status !== ProjectStatus.active) {
        logEvent("request.rejected", {
          operation: "review",
          userId,
          projectId,
          latencyMs: Date.now() - startedAt,
          code: "invalid_request",
        });
        return Response.json(
          { error: "This project is no longer active." },
          { status: 409 },
        );
      }

      await enforceRateLimit(user.id, "review");
      const provider = createLLMProvider();
      const projectDefinition = toProjectDefinition(project);

      const stream = new ReadableStream({
        async start(controller) {
          const heartbeat = setInterval(() => {
            controller.enqueue(
              event("progress", {
                message: "Still reviewing your submission",
              }),
            );
          }, REVIEW_HEARTBEAT_MS);

          await withRequestLogContext(logContext, async () => {
            try {
              controller.enqueue(
                event("progress", { message: "Reading your submission" }),
              );

              const review = await reviewSubmission(
                projectDefinition,
                code,
                provider,
              );
              controller.enqueue(
                event("progress", { message: "Saving your mentor feedback" }),
              );
              const nextStep = evaluateProgress(
                { currentLevel: project.track.currentLevel },
                review,
              );
              const savedReview =
                await new ReviewRepository().saveReviewAndUpdateProject({
                  code,
                  projectId: project.id,
                  trackId: project.track.id,
                  verdict:
                    review.verdict === "complete"
                      ? ReviewVerdict.complete
                      : ReviewVerdict.needs_work,
                  requirementStatus: review.requirementStatus,
                  feedback: review.feedback as Prisma.InputJsonValue,
                  difficultyDelta: nextStep.difficultyDelta,
                });

              if (!savedReview) {
                throw new AppError(
                  "invalid_request",
                  "This project is no longer active.",
                  409,
                );
              }

              logEvent("request.complete", {
                operation: "review",
                userId,
                projectId: project.id,
                latencyMs: Date.now() - startedAt,
                verdict: review.verdict,
              });
              controller.enqueue(
                event("review", { review, nextStep, reviewId: savedReview.id }),
              );
            } catch (error) {
              const appError = toAppError(error);
              logEvent("request.error", {
                operation: "review",
                userId,
                projectId: project.id,
                latencyMs: Date.now() - startedAt,
                code: appError.code,
              });
              controller.enqueue(
                event("error", {
                  error: appError.message,
                  retryable: appError.retryable,
                }),
              );
            } finally {
              clearInterval(heartbeat);
              controller.close();
            }
          });
        },
      });

      return new Response(stream, {
        headers: {
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
        },
      });
    } catch (error) {
      const appError = toAppError(error);
      logEvent("request.error", {
        operation: "review",
        userId,
        projectId,
        latencyMs: Date.now() - startedAt,
        code: appError.code,
      });
      return Response.json(
        { error: appError.message, retryable: appError.retryable },
        { status: appError.status },
      );
    }
  });
}
