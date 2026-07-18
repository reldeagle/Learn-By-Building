import {
  Prisma,
  ProjectStatus,
  ReviewFeedback,
  ReviewVerdict,
} from "../generated/prisma/client";

import { prisma } from "./client";

function isUniqueConstraintViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export class TrackRepository {
  create({
    userId,
    technology,
    currentLevel = 1,
  }: {
    userId: string;
    technology: string;
    currentLevel?: number;
  }) {
    return prisma.track.create({
      data: { userId, technology, currentLevel },
    });
  }

  getByUser(userId: string) {
    return prisma.track.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    });
  }

  getByUserWithProjects(userId: string) {
    return prisma.track.findMany({
      where: { userId },
      include: {
        projects: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { id: "asc" },
    });
  }

  getByUserAndTechnology(userId: string, technology: string) {
    return prisma.track.findUnique({
      where: { userId_technology: { userId, technology } },
      include: {
        projects: {
          where: { status: ProjectStatus.active },
          select: { id: true },
          take: 1,
        },
      },
    });
  }

  getByIdForUser(trackId: string, userId: string) {
    return prisma.track.findFirst({
      where: { id: trackId, userId },
    });
  }

  createWithFirstProject({
    userId,
    technology,
    currentLevel,
    project,
  }: {
    userId: string;
    technology: string;
    currentLevel: number;
    project: {
      difficulty: number;
      title: string;
      goal: string;
      expectedOutcome: string;
      hints: Prisma.InputJsonValue;
      requirements: string[];
    };
  }) {
    return prisma.track.create({
      data: {
        userId,
        technology,
        currentLevel,
        projects: {
          create: {
            order: 1,
            difficulty: project.difficulty,
            title: project.title,
            goal: project.goal,
            expectedOutcome: project.expectedOutcome,
            hints: project.hints,
            requirements: {
              create: project.requirements.map((text) => ({ text })),
            },
          },
        },
      },
      include: {
        projects: {
          include: { requirements: true },
        },
      },
    });
  }

  updateLevel(trackId: string, currentLevel: number) {
    return prisma.track.update({
      where: { id: trackId },
      data: { currentLevel },
    });
  }
}

export class ProjectRepository {
  create({
    trackId,
    order,
    difficulty,
    title,
    goal,
    expectedOutcome,
    hints,
    requirements,
  }: {
    trackId: string;
    order: number;
    difficulty: number;
    title: string;
    goal: string;
    expectedOutcome: string;
    hints: Prisma.InputJsonValue;
    requirements: string[];
  }) {
    return prisma.project.create({
      data: {
        trackId,
        order,
        difficulty,
        title,
        goal,
        expectedOutcome,
        hints,
        requirements: {
          create: requirements.map((text) => ({ text })),
        },
      },
      include: { requirements: true },
    });
  }

  getActive(trackId: string) {
    return prisma.project.findFirst({
      where: { trackId, status: ProjectStatus.active },
      include: { requirements: true },
      orderBy: { order: "asc" },
    });
  }

  getByIdForUser(projectId: string, userId: string) {
    return prisma.project.findFirst({
      where: {
        id: projectId,
        track: { userId },
      },
      include: {
        requirements: true,
        track: true,
      },
    });
  }

  async getNextOrder(trackId: string) {
    const latest = await prisma.project.aggregate({
      where: { trackId },
      _max: { order: true },
    });

    return (latest._max.order ?? 0) + 1;
  }

  getCompletedTitles(trackId: string) {
    return prisma.project.findMany({
      where: { trackId, status: ProjectStatus.completed },
      select: { title: true },
      orderBy: { order: "asc" },
    });
  }

  updateRequirementStatus(
    projectId: string,
    requirementStatus: Array<{ requirement: string; met: boolean }>,
  ) {
    return prisma.$transaction(
      requirementStatus.map(({ requirement, met }) =>
        prisma.requirement.updateMany({
          where: { projectId, text: requirement },
          data: { lastMet: met },
        }),
      ),
    );
  }

  markComplete(projectId: string) {
    return prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.completed },
    });
  }
}

export class SubmissionRepository {
  async saveSubmission(projectId: string, code: string) {
    for (let retry = 0; retry < 3; retry += 1) {
      const latest = await prisma.submission.aggregate({
        where: { projectId },
        _max: { attempt: true },
      });

      try {
        return await prisma.submission.create({
          data: {
            projectId,
            code,
            attempt: (latest._max.attempt ?? 0) + 1,
          },
        });
      } catch (error) {
        if (!isUniqueConstraintViolation(error) || retry === 2) {
          throw error;
        }
      }
    }

    throw new Error("Unable to save submission after retrying.");
  }

  listAttempts(projectId: string) {
    return prisma.submission.findMany({
      where: { projectId },
      include: { review: true },
      orderBy: { attempt: "asc" },
    });
  }
}

export class ReviewRepository {
  async saveReviewAndUpdateProject({
    submissionId,
    projectId,
    trackId,
    verdict,
    requirementStatus,
    feedback,
    difficultyDelta,
  }: {
    submissionId: string;
    projectId: string;
    trackId: string;
    verdict: ReviewVerdict;
    requirementStatus: Array<{ requirement: string; met: boolean }>;
    feedback: Prisma.InputJsonValue;
    difficultyDelta: 0 | 1;
  }) {
    return prisma.$transaction(async (transaction) => {
      const activeProject = await transaction.project.findFirst({
        where: { id: projectId, status: ProjectStatus.active },
        select: { id: true },
      });

      if (!activeProject) {
        return null;
      }

      if (verdict === ReviewVerdict.complete) {
        const completed = await transaction.project.updateMany({
          where: { id: projectId, status: ProjectStatus.active },
          data: { status: ProjectStatus.completed },
        });

        if (completed.count !== 1) {
          return null;
        }
      }

      const review = await transaction.review.create({
        data: {
          submissionId,
          verdict,
          requirementStatus: requirementStatus as Prisma.InputJsonValue,
          feedback,
        },
      });

      await Promise.all(
        requirementStatus.map(({ requirement, met }) =>
          transaction.requirement.updateMany({
            where: { projectId, text: requirement },
            data: { lastMet: met },
          }),
        ),
      );

      if (verdict === ReviewVerdict.complete) {
        await transaction.track.update({
          where: { id: trackId },
          data: { currentLevel: { increment: difficultyDelta } },
        });
      }

      return review;
    });
  }

  async getLatestForProjectForUser(projectId: string, userId: string) {
    const submission = await prisma.submission.findFirst({
      where: {
        projectId,
        project: { track: { userId } },
        review: { isNot: null },
      },
      include: { review: true },
      orderBy: { attempt: "desc" },
    });

    return submission?.review ?? null;
  }

  async setLearnerFeedbackForUser({
    reviewId,
    userId,
    rating,
  }: {
    reviewId: string;
    userId: string;
    rating: ReviewFeedback;
  }) {
    const result = await prisma.review.updateMany({
      where: {
        id: reviewId,
        submission: { project: { track: { userId } } },
      },
      data: { learnerFeedback: rating },
    });

    return result.count === 1;
  }
}

export class HintRepository {
  async getCurrentLevel(projectId: string) {
    const hintUnlock = await prisma.hintUnlock.findFirst({
      where: { projectId },
      select: { level: true },
      orderBy: { level: "desc" },
    });

    return hintUnlock?.level ?? 0;
  }

  recordUnlock(projectId: string, level: number) {
    return prisma.hintUnlock.upsert({
      where: { projectId_level: { projectId, level } },
      update: {},
      create: { projectId, level },
    });
  }
}

export class UserRepository {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  upsertByEmail(email: string) {
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });
  }
}
