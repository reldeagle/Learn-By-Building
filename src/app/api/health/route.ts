import { prisma } from "@/data/client";
import { getConfig } from "@/lib/config";

export async function GET() {
  const checks = {
    config: "ok" as "ok" | "fail",
    database: "ok" as "ok" | "fail",
  };

  try {
    getConfig();
  } catch {
    checks.config = "fail";
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    checks.database = "fail";
  }

  const healthy = checks.config === "ok" && checks.database === "ok";

  return Response.json(
    { checks, status: healthy ? "ok" : "unhealthy" },
    { status: healthy ? 200 : 503 },
  );
}
