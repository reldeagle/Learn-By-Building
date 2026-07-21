-- Reviewed baseline generated from prisma/schema.prisma.
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "ProjectStatus" AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE "ReviewVerdict" AS ENUM ('complete', 'needs_work');
CREATE TYPE "ReviewFeedback" AS ENUM ('thumbs_up', 'thumbs_down');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "hints" JSONB NOT NULL DEFAULT '[]',
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "lastMet" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "verdict" "ReviewVerdict" NOT NULL,
    "requirementStatus" JSONB NOT NULL,
    "feedback" JSONB NOT NULL,
    "learnerFeedback" "ReviewFeedback",

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HintUnlock" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HintUnlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Track_userId_idx" ON "Track"("userId");
CREATE UNIQUE INDEX "Track_userId_technology_key" ON "Track"("userId", "technology");
CREATE INDEX "Project_trackId_status_idx" ON "Project"("trackId", "status");
CREATE UNIQUE INDEX "Project_trackId_order_key" ON "Project"("trackId", "order");
CREATE INDEX "Requirement_projectId_idx" ON "Requirement"("projectId");
CREATE UNIQUE INDEX "Submission_projectId_attempt_key" ON "Submission"("projectId", "attempt");
CREATE UNIQUE INDEX "Review_submissionId_key" ON "Review"("submissionId");
CREATE UNIQUE INDEX "HintUnlock_projectId_level_key" ON "HintUnlock"("projectId", "level");

ALTER TABLE "Track" ADD CONSTRAINT "Track_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HintUnlock" ADD CONSTRAINT "HintUnlock_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
