import { notFound, redirect } from "next/navigation";

import { ReviewActions } from "@/components/review-actions";
import { ReviewFeedback } from "@/components/review-feedback";
import { ReviewStream } from "@/components/review-stream";
import {
  AttemptHistory,
  FeedbackItem,
  RequirementRow,
  VerdictBanner,
} from "@/components/project-ui";
import {
  ProjectRepository,
  ReviewRepository,
  SubmissionRepository,
} from "@/data/repositories";
import { getSignInUrl } from "@/lib/auth-redirect";
import { UnauthorizedError, requireUser } from "@/lib/auth";
import { ReviewSchema } from "@/lib/schemas";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submit?: string }>;
}) {
  const [{ id }, { submit }] = await Promise.all([params, searchParams]);
  let user;

  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(getSignInUrl(`/project/${id}/review`));
    }
    throw error;
  }

  const projects = new ProjectRepository();
  const project = await projects.getByIdForUser(id, user.id);

  if (!project) {
    notFound();
  }

  return (
    <main className="min-h-full flex-1 bg-slate-950 px-6 py-10 text-slate-100 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          React track · Project {project.order} · Mentor review
        </p>
        {submit === "1" ? (
          <div className="mt-6">
            <ReviewStream projectId={project.id} trackId={project.track.id} />
          </div>
        ) : (
          <div className="mt-6">
            <PersistedReview
              projectId={project.id}
              trackId={project.track.id}
              userId={user.id}
            />
          </div>
        )}
      </div>
    </main>
  );
}

async function PersistedReview({
  projectId,
  trackId,
  userId,
}: {
  projectId: string;
  trackId: string;
  userId: string;
}) {
  const [review, submissions, activeProject] = await Promise.all([
    new ReviewRepository().getLatestForProjectForUser(projectId, userId),
    new SubmissionRepository().listAttempts(projectId, userId),
    new ProjectRepository().getActive(trackId),
  ]);

  if (!review) {
    redirect(`/project/${projectId}`);
  }

  const result = ReviewSchema.parse({
    verdict: review.verdict,
    requirementStatus: review.requirementStatus,
    feedback: review.feedback,
  });
  const attempts = submissions.flatMap((submission) => {
    if (!submission.review) {
      return [];
    }

    const attemptReview = ReviewSchema.parse({
      verdict: submission.review.verdict,
      requirementStatus: submission.review.requirementStatus,
      feedback: submission.review.feedback,
    });

    return [
      {
        attempt: submission.attempt,
        createdAt: submission.createdAt,
        requirementsMet: attemptReview.requirementStatus.filter(
          (status) => status.met,
        ).length,
        requirementsTotal: attemptReview.requirementStatus.length,
        verdict: attemptReview.verdict,
      },
    ];
  });

  return (
    <div className="space-y-8">
      <VerdictBanner verdict={result.verdict} />

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">
          Requirements
        </h2>
        <ul className="mt-4 space-y-3">
          {result.requirementStatus.map((status) => (
            <RequirementRow
              key={status.requirement}
              met={status.met}
              reason={status.reason}
              text={status.requirement}
            />
          ))}
        </ul>
      </section>

      {result.feedback.length ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">
            Mentor feedback
          </h2>
          <ul className="mt-4 space-y-3">
            {result.feedback.map((item, index) => (
              <FeedbackItem
                issue={item.issue}
                key={`${item.issue}-${index}`}
                priority={item.priority}
                why={item.why}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {attempts.length ? <AttemptHistory attempts={attempts} /> : null}

      <ReviewFeedback
        initialRating={review.learnerFeedback}
        reviewId={review.id}
      />
      <ReviewActions
        nextProjectId={activeProject?.id}
        projectId={projectId}
        trackId={trackId}
        verdict={result.verdict}
      />
    </div>
  );
}
