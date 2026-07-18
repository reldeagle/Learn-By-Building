"use client";

import { useEffect, useState } from "react";

import { ReviewActions } from "@/components/review-actions";
import { ReviewFeedback } from "@/components/review-feedback";
import { ReviewSchema, type Review } from "@/lib/schemas";

function StreamedReview({ review }: { review: Review }) {
  const complete = review.verdict === "complete";

  return (
    <div className="space-y-8">
      <section
        className={`rounded-2xl border p-6 ${
          complete
            ? "border-emerald-400/25 bg-emerald-400/10"
            : "border-amber-400/25 bg-amber-400/10"
        }`}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">
          Review result
        </p>
        <h1
          className={`mt-3 text-2xl font-semibold tracking-tight ${
            complete ? "text-emerald-200" : "text-amber-200"
          }`}
        >
          {complete ? "Project complete" : "A few things to improve"}
        </h1>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">
          Requirements
        </h2>
        <ul className="mt-4 space-y-3">
          {review.requirementStatus.map((status) => (
            <li
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
              key={status.requirement}
            >
              <p className="font-medium text-slate-100">{status.requirement}</p>
              <p
                className={`mt-1 text-sm ${
                  status.met ? "text-emerald-300" : "text-slate-400"
                }`}
              >
                {status.met ? "Met" : "Needs attention"} — {status.reason}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {review.feedback.length ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">
            Mentor feedback
          </h2>
          <ul className="mt-4 space-y-3">
            {review.feedback.map((item, index) => (
              <li
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                key={`${item.issue}-${index}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-medium text-slate-100">{item.issue}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                      item.priority === "high"
                        ? "bg-rose-400/15 text-rose-200"
                        : item.priority === "medium"
                          ? "bg-amber-400/15 text-amber-200"
                          : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {item.priority}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {item.why}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

class ReviewStreamError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export function ReviewStream({
  projectId,
  trackId,
}: {
  projectId: string;
  trackId: string;
}) {
  const [reviewProgress, setReviewProgress] = useState(
    "Preparing your mentor review",
  );
  const [review, setReview] = useState<Review | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [error, setError] = useState<{
    message: string;
    retryable: boolean;
  } | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function submitForReview() {
      const storageKey = `learn-by-building:submission:${projectId}`;
      const code = window.sessionStorage.getItem(storageKey);

      if (!code) {
        setError({
          message:
            "Your submission is no longer available. Return to the project and submit it again.",
          retryable: false,
        });
        return;
      }

      try {
        const response = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, code }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          const message =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof payload.error === "string"
              ? payload.error
              : "Unable to review this submission.";
          const retryable =
            typeof payload === "object" &&
            payload !== null &&
            "retryable" in payload &&
            typeof payload.retryable === "boolean"
              ? payload.retryable
              : response.status >= 500;
          throw new ReviewStreamError(message, retryable);
        }

        if (!response.body) {
          throw new ReviewStreamError(
            "Your mentor is unavailable right now. Please try again.",
            true,
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let receivedReview = false;

        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });

          let delimiter = buffer.indexOf("\n\n");
          while (delimiter !== -1) {
            const message = buffer.slice(0, delimiter);
            buffer = buffer.slice(delimiter + 2);
            delimiter = buffer.indexOf("\n\n");

            const name = message
              .split("\n")
              .find((line) => line.startsWith("event:"))
              ?.slice(6)
              .trim();
            const data = message
              .split("\n")
              .find((line) => line.startsWith("data:"))
              ?.slice(5)
              .trim();

            if (!name || !data) {
              continue;
            }

            const payload: unknown = JSON.parse(data);
            if (name === "progress") {
              const progress =
                typeof payload === "object" &&
                payload !== null &&
                "message" in payload &&
                typeof payload.message === "string"
                  ? payload.message
                  : null;

              if (progress && !cancelled) {
                setReviewProgress(progress);
              }
            }

            if (name === "error") {
              const message =
                typeof payload === "object" &&
                payload !== null &&
                "error" in payload &&
                typeof payload.error === "string"
                  ? payload.error
                  : "Unable to review this submission.";
              const retryable =
                typeof payload === "object" &&
                payload !== null &&
                "retryable" in payload &&
                typeof payload.retryable === "boolean"
                  ? payload.retryable
                  : false;
              throw new ReviewStreamError(message, retryable);
            }

            if (name === "review") {
              const parsed =
                typeof payload === "object" &&
                payload !== null &&
                "review" in payload
                  ? ReviewSchema.safeParse(payload.review)
                  : { success: false as const };
              const persistedReviewId =
                typeof payload === "object" &&
                payload !== null &&
                "reviewId" in payload &&
                typeof payload.reviewId === "string"
                  ? payload.reviewId
                  : null;

              if (!parsed.success || !persistedReviewId) {
                throw new Error("Received an invalid review.");
              }

              receivedReview = true;
              if (!cancelled) {
                setReview(parsed.data);
                setReviewId(persistedReviewId);
                window.sessionStorage.removeItem(storageKey);
                window.localStorage.removeItem(
                  `learn-by-building:submission-draft:${projectId}`,
                );
                window.history.replaceState(
                  {},
                  "",
                  `/project/${projectId}/review`,
                );
              }
            }
          }

          if (done) {
            break;
          }
        }

        if (!receivedReview) {
          throw new Error("Review ended before a result was available.");
        }
      } catch (streamError) {
        if (!cancelled && !(streamError instanceof DOMException)) {
          setError({
            message:
              streamError instanceof ReviewStreamError
                ? streamError.message
                : "Unable to review this submission. Please try again.",
            retryable:
              streamError instanceof ReviewStreamError
                ? streamError.retryable
                : true,
          });
        }
      }
    }

    void submitForReview();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, retryAttempt]);

  if (error) {
    return (
      <section className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-6">
        <h1 className="text-xl font-semibold tracking-tight text-rose-100">
          Review unavailable
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">{error.message}</p>
        {error.retryable ? (
          <button
            className="mt-5 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            onClick={() => {
              setError(null);
              setReviewProgress("Preparing your mentor review");
              setRetryAttempt((attempt) => attempt + 1);
            }}
            type="button"
          >
            Retry review
          </button>
        ) : null}
        <a
          className="mt-5 inline-flex rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
          href={`/project/${projectId}`}
        >
          Return to project
        </a>
      </section>
    );
  }

  if (review && reviewId) {
    return (
      <div className="space-y-8">
        <StreamedReview review={review} />
        <ReviewFeedback initialRating={null} reviewId={reviewId} />
        <ReviewActions
          projectId={projectId}
          trackId={trackId}
          verdict={review.verdict}
        />
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
        Mentor review
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-100">
        {reviewProgress}
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        Your mentor is checking each requirement before sharing feedback.
      </p>
    </section>
  );
}
