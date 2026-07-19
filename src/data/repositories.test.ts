import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("./client", () => ({
  prisma: { submission: { findMany: mocks.findMany } },
}));

import { SubmissionRepository } from "./repositories";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([]);
});

describe("SubmissionRepository.listAttempts", () => {
  it("scopes attempts to the project owner", async () => {
    await new SubmissionRepository().listAttempts("project-1", "user-1");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        project: { track: { userId: "user-1" } },
      },
      include: { review: true },
      orderBy: { attempt: "asc" },
    });
  });
});
