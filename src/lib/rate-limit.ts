type RateLimitOperation = "generation" | "review" | "hint";

const limits: Record<RateLimitOperation, number> = {
  generation: 5,
  review: 10,
  hint: 20,
};
const windowMs = 60_000;
const requests = new Map<string, number[]>();

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Please try again shortly.");
    this.name = "RateLimitError";
  }
}

export function enforceRateLimit(
  userId: string,
  operation: RateLimitOperation,
) {
  const key = `${userId}:${operation}`;
  const now = Date.now();
  const recentRequests = (requests.get(key) ?? []).filter(
    (timestamp) => timestamp > now - windowMs,
  );

  if (recentRequests.length >= limits[operation]) {
    requests.set(key, recentRequests);
    throw new RateLimitError();
  }

  recentRequests.push(now);
  requests.set(key, recentRequests);
}
