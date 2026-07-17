import Link from "next/link";

export function RequirementRow({
  text,
  met,
  reason,
}: {
  text: string;
  met?: boolean;
  reason?: string;
}) {
  const status = met === undefined ? null : met ? "Met" : "Needs attention";

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            met === undefined
              ? "bg-slate-800 text-slate-400"
              : met
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-slate-800 text-slate-400"
          }`}
        >
          {met ? "✓" : "•"}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-slate-100">{text}</p>
          {status ? (
            <p
              className={`mt-1 text-sm ${
                met ? "text-emerald-300" : "text-slate-400"
              }`}
            >
              {status}
              {reason ? ` — ${reason}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function VerdictBanner({
  verdict,
}: {
  verdict: "complete" | "needs_work";
}) {
  const complete = verdict === "complete";

  return (
    <section
      className={`rounded-2xl border p-6 ${
        complete
          ? "border-emerald-400/25 bg-emerald-400/10"
          : "border-amber-400/25 bg-amber-400/10"
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">
        Review result
      </p>
      <h1
        className={`mt-3 text-2xl font-semibold tracking-tight ${
          complete ? "text-emerald-200" : "text-amber-200"
        }`}
      >
        {complete ? "Project complete" : "A few things to improve"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        {complete
          ? "Every requirement was demonstrated in this submission."
          : "Use the requirement notes and feedback below to guide your next pass."}
      </p>
    </section>
  );
}

export function FeedbackItem({
  issue,
  why,
  priority,
}: {
  issue: string;
  why: string;
  priority: "high" | "medium" | "low";
}) {
  const colors = {
    high: "bg-rose-400/15 text-rose-200",
    medium: "bg-amber-400/15 text-amber-200",
    low: "bg-slate-800 text-slate-300",
  };

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-medium text-slate-100">{issue}</h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${colors[priority]}`}
        >
          {priority}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{why}</p>
    </li>
  );
}

export function ProjectCard({
  title,
  status,
  href,
}: {
  title: string;
  status: "active" | "completed" | "upcoming";
  href?: string;
}) {
  const content = (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${
        status === "active"
          ? "border-cyan-400/30 bg-cyan-400/10"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      <div>
        <p className="font-medium text-slate-100">{title}</p>
        <p className="mt-1 text-sm text-slate-400">
          {status === "active"
            ? "Active project"
            : status === "completed"
              ? "Completed"
              : "Unlock by completing your active project"}
        </p>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
          status === "active"
            ? "bg-cyan-300/15 text-cyan-200"
            : status === "completed"
              ? "bg-emerald-400/15 text-emerald-200"
              : "bg-slate-800 text-slate-400"
        }`}
      >
        {status}
      </span>
    </div>
  );

  return href ? (
    <Link className="block transition hover:brightness-110" href={href}>
      {content}
    </Link>
  ) : (
    content
  );
}
