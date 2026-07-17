import type { Review } from "../../lib/schemas";

export type ProgressionTrack = {
  currentLevel: number;
};

export type NextStep = {
  action: "unlock_next" | "repeat_same_level";
  difficultyDelta: 0 | 1;
};

export function evaluateProgress(
  track: ProgressionTrack,
  review: Review,
): NextStep {
  if (!Number.isInteger(track.currentLevel) || track.currentLevel < 1) {
    throw new Error("Track level must be a positive integer.");
  }

  return review.verdict === "complete"
    ? { action: "unlock_next", difficultyDelta: 1 }
    : { action: "repeat_same_level", difficultyDelta: 0 };
}
