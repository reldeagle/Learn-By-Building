import Link from "next/link";
import { redirect } from "next/navigation";

import { ProjectCard } from "@/components/project-ui";
import { TrackRepository } from "@/data/repositories";
import { getSignInUrl } from "@/lib/auth-redirect";
import { UnauthorizedError, requireUser } from "@/lib/auth";

export default async function TrackPage() {
  let user;

  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(getSignInUrl("/track"));
    }
    throw error;
  }

  const tracks = await new TrackRepository().getByUserWithProjects(user.id);

  if (!tracks.length) {
    redirect("/start");
  }

  const track = tracks[0];
  const activeProject = track.projects.find(
    (project) => project.status === "active",
  );
  const completedProjects = track.projects.filter(
    (project) => project.status === "completed",
  );
  const latestCompletedProject = completedProjects.at(-1);

  return (
    <main className="min-h-full flex-1 bg-slate-950 px-6 py-10 text-slate-100 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          React track · Level {track.currentLevel}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your learning path
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Complete the current project to unlock the next focused challenge.
        </p>

        <section className="mt-9 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
            Current project
          </p>
          {activeProject ? (
            <>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-100">
                Project {activeProject.order}: {activeProject.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {activeProject.goal}
              </p>
              <Link
                className="mt-5 inline-flex rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                href={`/project/${activeProject.id}`}
              >
                Continue project
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Your next project is ready to unlock from the latest completed
                review.
              </p>
              {latestCompletedProject ? (
                <Link
                  className="mt-5 inline-flex rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                  href={`/project/${latestCompletedProject.id}/review`}
                >
                  Unlock next project
                </Link>
              ) : null}
            </>
          )}
        </section>

        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-slate-100">
              Completed work
            </h2>
            <p className="text-sm text-slate-400">
              {completedProjects.length} completed
            </p>
          </div>
          {completedProjects.length ? (
            <div className="mt-4 space-y-3">
              {completedProjects.map((project) => (
                <ProjectCard
                  href={`/project/${project.id}/review`}
                  key={project.id}
                  status="completed"
                  title={`Project ${project.order}: ${project.title}`}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
              Your completed projects will appear here after your first mentor
              review.
            </p>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">
            Next unlock
          </h2>
          <div className="mt-4">
            {activeProject ? (
              <ProjectCard status="upcoming" title="Next React project" />
            ) : (
              <p className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 text-sm leading-6 text-slate-400">
                Open the latest completed review to generate the next project at
                your current level.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
