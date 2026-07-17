import { type Hint, type Project } from "../../lib/schemas";

export function nextHint(project: Project, currentLevel: number): Hint {
  if (!Number.isInteger(currentLevel) || currentLevel < 0) {
    throw new Error("Hint level must be a non-negative integer.");
  }

  const nextLevel = currentLevel + 1;
  const hint = project.hints.find(
    (item) => !item.isSolution && item.level === nextLevel,
  );

  if (hint) {
    return hint;
  }

  const solution = project.hints.find((item) => item.isSolution);

  if (solution) {
    return solution;
  }

  throw new Error("Project does not include a solution hint.");
}
