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

  return (
    <main className="min-h-full flex-1 bg-slate-950 px-6 py-10 text-slate-100 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Your track
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          React projects
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Complete the active project to unlock what comes next.
        </p>

        <div className="mt-9 space-y-3">
          {tracks.flatMap((track) => {
            const activeProject = track.projects.find(
              (project) => project.status === "active",
            );

            return [
              ...track.projects
                .filter(
                  (project) =>
                    project.status === "active" ||
                    project.status === "completed",
                )
                .map((project) => (
                  <ProjectCard
                    href={
                      project.status === "active"
                        ? `/project/${project.id}`
                        : `/project/${project.id}/review`
                    }
                    key={project.id}
                    status={
                      project.status === "active" ? "active" : "completed"
                    }
                    title={`Project ${project.order}: ${project.title}`}
                  />
                )),
              activeProject ? (
                <ProjectCard
                  key={`${track.id}-upcoming`}
                  status="upcoming"
                  title="Next project"
                />
              ) : null,
            ];
          })}
        </div>
      </div>
    </main>
  );
}
