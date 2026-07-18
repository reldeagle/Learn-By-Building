import Link from "next/link";
import { getServerSession } from "next-auth";

import { TrackRepository, UserRepository } from "@/data/repositories";
import { getSignInUrl } from "@/lib/auth-redirect";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  const user = email ? await new UserRepository().findByEmail(email) : null;
  const tracks = user
    ? await new TrackRepository().getByUserWithProjects(user.id)
    : [];
  const activeProject = tracks
    .flatMap((track) => track.projects)
    .find((project) => project.status === "active");
  const completedCount = tracks.reduce(
    (total, track) =>
      total +
      track.projects.filter((project) => project.status === "completed").length,
    0,
  );

  return (
    <main className="flex min-h-full flex-1 items-center bg-slate-950 px-6 py-12 text-slate-100 sm:py-16">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl shadow-slate-950/40 sm:p-10">
        {user ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
              Welcome back
            </p>
            <h1 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Keep building your React skills.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              {activeProject
                ? `Your current project is ${activeProject.title}. Pick up where you left off and ask your mentor for review when you are ready.`
                : tracks.length
                  ? "Your latest review is complete. Visit your track to see what to build next."
                  : "Set your starting point and your mentor will create a first React project sized for you."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                href={
                  activeProject
                    ? `/project/${activeProject.id}`
                    : tracks.length
                      ? "/track"
                      : "/start"
                }
              >
                {activeProject
                  ? "Continue current project"
                  : tracks.length
                    ? "View your track"
                    : "Start your React track"}
              </Link>
              {tracks.length ? (
                <Link
                  className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                  href="/track"
                >
                  View progress{completedCount ? ` (${completedCount})` : ""}
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
              React mentorship by building
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Build projects. Get mentored. Earn the next challenge.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Build in the app or your own editor, then get practical feedback
              that explains what to improve and why.
            </p>
            <Link
              className="mt-8 inline-flex rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              href={getSignInUrl("/start")}
            >
              Start your React track
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
