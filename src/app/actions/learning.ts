"use server";

import { Prisma } from "@/generated/prisma/client";
import { createLLMProvider } from "@/ai/provider";
import {
  HintRepository,
  ProjectRepository,
  ReviewRepository,
  TrackRepository,
} from "@/data/repositories";
import { ReviewFeedback } from "@/generated/prisma/client";
import { AppError, type AppErrorCode, toAppError } from "@/lib/app-error";
import { nextHint } from "@/modules/hint-system";
import { generateProject } from "@/modules/project-generator";
import { requireUser } from "@/lib/auth";
import {
  createRequestLogContext,
  logEvent,
  withRequestLogContext,
} from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  LearnerContextSchema,
  ProjectSchema,
  ReviewFeedbackInputSchema,
  RequestHintInputSchema,
  RequestNextProjectInputSchema,
  StartTrackInputSchema,
} from "@/lib/schemas";

function levelFromCalibration(
  level: "beginner" | "intermediate" | "experienced",
) {
  return level === "beginner" ? 1 : level === "intermediate" ? 2 : 3;
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

type StartTrackResult =
  | {
      projectId: string | null;
      status: "created" | "resumed";
      trackId: string;
    }
  | {
      code: AppErrorCode;
      message: string;
      retryable: boolean;
      status: "error";
    };

async function findExistingTrack(
  tracks: TrackRepository,
  userId: string,
  technology: string,
) {
  const track = await tracks.getByUserAndTechnology(userId, technology);

  return track
    ? { projectId: track.projects[0]?.id ?? null, trackId: track.id }
    : null;
}

export async function startTrack(input: unknown): Promise<StartTrackResult> {
  return withRequestLogContext(
    createRequestLogContext("start_track"),
    async () => {
      const startedAt = Date.now();
      let userId: string | null = null;

      try {
        const data = StartTrackInputSchema.parse(input);
        const user = await requireUser();
        userId = user.id;
        const currentLevel = levelFromCalibration(data.level);
        const tracks = new TrackRepository();
        const existingTrack = await findExistingTrack(
          tracks,
          user.id,
          data.technology,
        );

        if (existingTrack) {
          logEvent("request.complete", {
            operation: "start_track",
            outcome: "resumed",
            userId,
            latencyMs: Date.now() - startedAt,
          });
          return { ...existingTrack, status: "resumed" };
        }

        await enforceRateLimit(user.id, "generation");
        const project = await generateProject(
          {
            technology: data.technology,
            currentLevel,
            completedProjects: [],
            jsExperience: data.jsExperience,
          },
          createLLMProvider(),
        );
        let track;

        try {
          track = await tracks.createWithFirstProject({
            userId: user.id,
            technology: data.technology,
            currentLevel,
            project: {
              difficulty: currentLevel,
              title: project.title,
              goal: project.goal,
              expectedOutcome: project.expectedOutcome,
              hints: project.hints as Prisma.InputJsonValue,
              requirements: project.requirements,
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            const concurrentTrack = await findExistingTrack(
              tracks,
              user.id,
              data.technology,
            );

            if (concurrentTrack) {
              logEvent("request.complete", {
                operation: "start_track",
                outcome: "resumed",
                userId,
                latencyMs: Date.now() - startedAt,
              });
              return { ...concurrentTrack, status: "resumed" };
            }
          }

          throw error;
        }

        logEvent("request.complete", {
          operation: "start_track",
          outcome: "created",
          userId,
          latencyMs: Date.now() - startedAt,
        });
        return {
          projectId: track.projects[0]?.id ?? null,
          status: "created",
          trackId: track.id,
        };
      } catch (error) {
        const appError = toAppError(error);
        logEvent("request.error", {
          operation: "start_track",
          userId,
          latencyMs: Date.now() - startedAt,
          code: appError.code,
        });
        return {
          code: appError.code,
          message: appError.message,
          retryable: appError.retryable,
          status: "error",
        };
      }
    },
  );
}

export async function requestNextProject(trackId: string) {
  return withRequestLogContext(
    createRequestLogContext("next_project"),
    async () => {
      const startedAt = Date.now();
      let userId: string | null = null;

      try {
        const input = RequestNextProjectInputSchema.parse({ trackId });
        const user = await requireUser();
        userId = user.id;
        const tracks = new TrackRepository();
        const projects = new ProjectRepository();
        const track = await tracks.getByIdForUser(input.trackId, user.id);

        if (!track) {
          throw new AppError("not_found", "Track not found.", 404);
        }

        await enforceRateLimit(user.id, "generation");
        const activeProject = await projects.getActive(track.id);

        if (activeProject) {
          throw new AppError(
            "invalid_request",
            "Complete the active project before requesting another.",
            409,
          );
        }

        const completedProjects = await projects.getCompletedTitles(track.id);
        const context = LearnerContextSchema.parse({
          technology: track.technology,
          currentLevel: track.currentLevel,
          completedProjects: completedProjects.map((project) => project.title),
        });
        const generatedProject = await generateProject(
          context,
          createLLMProvider(),
        );
        const order = await projects.getNextOrder(track.id);
        const project = await projects.create({
          trackId: track.id,
          order,
          difficulty: track.currentLevel,
          title: generatedProject.title,
          goal: generatedProject.goal,
          expectedOutcome: generatedProject.expectedOutcome,
          hints: generatedProject.hints as Prisma.InputJsonValue,
          requirements: generatedProject.requirements,
        });

        logEvent("request.complete", {
          operation: "next_project",
          userId,
          latencyMs: Date.now() - startedAt,
        });
        return project;
      } catch (error) {
        const appError = toAppError(error);
        logEvent("request.error", {
          operation: "next_project",
          userId,
          latencyMs: Date.now() - startedAt,
          code: appError.code,
        });
        throw appError;
      }
    },
  );
}

export async function requestHint(projectId: string) {
  return withRequestLogContext(createRequestLogContext("hint"), async () => {
    const startedAt = Date.now();
    let userId: string | null = null;

    try {
      const input = RequestHintInputSchema.parse({ projectId });
      const user = await requireUser();
      userId = user.id;
      const projects = new ProjectRepository();
      const project = await projects.getByIdForUser(input.projectId, user.id);

      if (!project) {
        throw new AppError("not_found", "Project not found.", 404);
      }

      await enforceRateLimit(user.id, "hint");
      const hintRepository = new HintRepository();
      const currentLevel = await hintRepository.getCurrentLevel(project.id);
      const hint = nextHint(toProjectDefinition(project), currentLevel);

      await hintRepository.recordUnlock(project.id, hint.level);

      logEvent("request.complete", {
        operation: "hint",
        userId,
        latencyMs: Date.now() - startedAt,
      });
      return hint;
    } catch (error) {
      const appError = toAppError(error);
      logEvent("request.error", {
        operation: "hint",
        userId,
        latencyMs: Date.now() - startedAt,
        code: appError.code,
      });
      throw appError;
    }
  });
}

export async function submitReviewFeedback(input: unknown) {
  try {
    const data = ReviewFeedbackInputSchema.parse(input);
    const user = await requireUser();
    const saved = await new ReviewRepository().setLearnerFeedbackForUser({
      reviewId: data.reviewId,
      userId: user.id,
      rating:
        data.rating === "thumbs_up"
          ? ReviewFeedback.thumbs_up
          : ReviewFeedback.thumbs_down,
    });

    if (!saved) {
      throw new AppError("not_found", "Review not found.", 404);
    }

    return { rating: data.rating };
  } catch (error) {
    throw toAppError(error);
  }
}
