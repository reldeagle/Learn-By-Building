import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/data/client";

export type RateLimitOperation = "generation" | "review" | "hint";

const limits: Record<RateLimitOperation, number> = {
  generation: 5,
  review: 10,
  hint: 20,
};
const windowMs = 60_000;

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Please try again shortly.");
    this.name = "RateLimitError";
  }
}

function currentWindowStart(now: number) {
  return new Date(Math.floor(now / windowMs) * windowMs);
}

export async function enforceRateLimit(
  userId: string,
  operation: RateLimitOperation,
  now = Date.now(),
) {
  const windowStart = currentWindowStart(now);
  const key = `${operation}:${userId}`;
  const result = await prisma.$queryRaw<Array<{ count: number }>>(
    Prisma.sql`
      INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
      VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT ("key") DO UPDATE SET
        "windowStart" = CASE
          WHEN "RateLimitBucket"."windowStart" < ${windowStart}
          THEN ${windowStart}
          ELSE "RateLimitBucket"."windowStart"
        END,
        "count" = CASE
          WHEN "RateLimitBucket"."windowStart" < ${windowStart}
          THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END
      RETURNING "count"
    `,
  );
  const count = Number(result[0]?.count);

  if (!Number.isFinite(count) || count > limits[operation]) {
    throw new RateLimitError();
  }
}
