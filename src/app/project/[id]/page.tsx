import { notFound, redirect } from "next/navigation";

import { CodeInput } from "@/components/code-input";
import { HintControl } from "@/components/hint-control";
import { RequirementRow } from "@/components/project-ui";
import { HintRepository, ProjectRepository } from "@/data/repositories";
import { getSignInUrl } from "@/lib/auth-redirect";
import { UnauthorizedError, requireUser } from "@/lib/auth";
import { ProjectSchema } from "@/lib/schemas";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let user;

  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(getSignInUrl(`/project/${id}`));
    }
    throw error;
  }

  const project = await new ProjectRepository().getByIdForUser(id, user.id);

  if (!project) {
    notFound();
  }

  if (project.status === "completed") {
    redirect(`/project/${project.id}/review`);
  }

  const definition = ProjectSchema.parse({
    title: project.title,
    goal: project.goal,
    requirements: project.requirements.map((requirement) => requirement.text),
    expectedOutcome: project.expectedOutcome,
    hints: project.hints,
  });
  const currentHintLevel = await new HintRepository().getCurrentLevel(
    project.id,
  );
  const revealedHints = definition.hints.filter(
    (hint) => hint.level <= currentHintLevel,
  );

  return (
    <main className="min-h-full flex-1 bg-slate-950 px-6 py-10 text-slate-100 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
            React track · Project {project.order} · Level {project.difficulty}
          </p>
        </header>

        <section className="mt-7 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {project.title}
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            {project.goal}
          </p>

          <div className="mt-7 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1.5">
              {project.requirements.length} requirements
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1.5">
              Mentor review unlocks the next project
            </span>
          </div>

          <div className="mt-9">
            <h2 className="text-lg font-semibold tracking-tight">
              What to build
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Your submission is reviewed against each of these points.
            </p>
            <ul className="mt-4 space-y-3">
              {project.requirements.map((requirement) => (
                <RequirementRow key={requirement.id} text={requirement.text} />
              ))}
            </ul>
          </div>

          <div className="mt-9 rounded-xl border border-slate-800 bg-slate-950/50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">
              Done looks like
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {project.expectedOutcome}
            </p>
          </div>

          <div className="mt-8">
            <HintControl
              hints={definition.hints}
              initiallyRevealed={revealedHints}
              projectId={project.id}
            />
          </div>
        </section>

        <div className="mt-6" id="submission">
          <CodeInput projectId={project.id} />
        </div>
      </div>
    </main>
  );
}
