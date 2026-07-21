# Learn By Building

**Learn By Building** is an AI-mentor coding-education web app. Instead of watching lessons, learners are handed increasingly difficult real projects by an AI mentor, submit their own code, and get concise feedback that *explains* mistakes rather than fixing them. Progression is earned by demonstrated ability, not by chapter number.

> Status: **complete and deployed.** All build and polish phases have shipped. **Live demo: <https://learn-by-building-lilac.vercel.app>** · License: [MIT](LICENSE). See [Project Status](#project-status) and [Troubleshooting](#troubleshooting-core-flows) before reporting a local or deployment issue.

---

## Live Demo & Judging Quick Start

**Live app:** <https://learn-by-building-lilac.vercel.app> (health check at [`/api/health`](https://learn-by-building-lilac.vercel.app/api/health))

**Demo video (3 min):** <https://youtu.be/srG3xDc5ORg>

The fastest way to see the whole loop:

1. Sign in with Google, pick **React**, add a one-line note about your JavaScript background, and start the track. Your first project gets generated in a few seconds.
2. Read the project: goal, requirements checklist, expected outcome. Try the hint ladder if you're curious (nudge → specific → near-solution → solution).
3. Paste the sample submission below and submit it for review.
4. Read the mentor review. It goes requirement by requirement and explains what's wrong and why — it never hands you rewritten code.
5. Fix things and resubmit until the project is complete, refresh to see the **Your attempts** history, then unlock the next project.

Projects are generated per learner so the exact requirements vary — any small React component works as a submission. This one gives the mentor plenty to talk about:

<details>
<summary><strong>Sample submission — a task list with deliberate mistakes</strong></summary>

```jsx
import { useState } from "react";

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [text, setText] = useState("");

  function addTask() {
    tasks.push({ name: text, done: false });
    setTasks(tasks);
    setText("");
  }

  function toggle(i) {
    tasks[i].done = !tasks[i].done;
    setTasks(tasks);
  }

  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={addTask()}>Add</button>
      <ul>
        {tasks.map((t) => (
          <li onClick={toggle}>
            {t.done ? "✓ " : ""}
            {t.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Seeded issues for the mentor to find: direct state mutation, `onClick={addTask()}` invoked during render, a missing list `key`, a click handler that never receives its index, and no empty-input guard.

</details>

**No API keys?** The whole loop also runs fully offline: set `LLM_PROVIDER=fake` locally (see [Local setup](#local-setup)) for a deterministic demo without calling any model.

---

## How I Used Codex and GPT-5.6

I built this for OpenAI Build Week with Codex running GPT-5.6, and Codex did most of the implementation work.

My approach was docs-first. Before any code, I wrote up what I wanted: the [PRD](PRD-Learn-By-Building.md), the [architecture](ARCHITECTURE.md), and a numbered task list ([TASKS.md](TASKS.md) / [ROADMAP.md](ROADMAP.md)), plus [AGENTS.md](AGENTS.md) with the rules I wanted the agent to work under — keep it simple, small diffs, don't change the stack, and the docs win over the code when they disagree. Then I pointed Codex at the task list and worked through it phase by phase. You can see this directly in the commit history: most commits map to a phase (`fix: restore phase 10 AI mentor reliability`, `feat: complete phase 12 learner depth`), and each task had to pass its own checks before I moved to the next one.

Where Codex saved me the most time:

- Scaffolding the whole core loop: the four domain modules (`project-generator`, `code-review`, `hint-system`, `progression`), the provider-agnostic AI layer, the Prisma repositories, and the App Router UI.
- Tests. Codex wrote the 12 Vitest suites and the 5-flow Playwright smoke suite alongside the features (not after), and hooked them into CI with a deterministic fake provider so CI never calls a live model.
- Debugging the ugly stuff. The mentor review kept coming back empty — it turned out `gemini-2.5-flash` was quietly spending the entire output budget on thinking tokens. Codex tracked that down and fixed it (`thinkingConfig`, bigger budgets, and real error logging so failures name their cause). It also caught a Prisma migration checksum drift that would have broken every future deploy.
- The whole polish round ([ROADMAP.md](ROADMAP.md), tasks 51–78): unifying the streamed and saved review UI, branded error/404 pages, attempt history, the health endpoint, security headers, serverless timeouts, and rate-limit ordering.

Decisions I worked through with GPT-5.6 before committing to them:

- One provider-agnostic `LLMProvider` interface with Zod-validated structured output, so every model response that drives app logic gets schema-checked — with one automatic repair retry when the model gets it wrong.
- "Explain, don't fix" enforced in the prompt *and* the response schema, not just as a vibe. The mentor is never allowed to hand back rewritten code — that's the whole product.
- Everything AI and database stays server-side; the browser only ever talks to server actions and route handlers.
- Rate limiting lives in the database instead of in memory, because serverless.

---

## Core Loop

**Pick skill → generate project → build → AI review → hints → unlock next.**

1. **Pick a skill** — choose a technology (React only in MVP) and answer a short calibration (prior JS experience, self-rated level).
2. **Generate a project** — the AI produces a right-sized project (~15–30 min) with a goal, a concrete requirements checklist, and an expected outcome.
3. **Build it** — in the focused in-app editor or your own editor; you can also upload supported source files for review.
4. **Submit for review** — paste or upload your code; the AI reviews correctness, bugs, readability, and best practices, explaining the *why* behind each issue.
5. **Improve or unlock** — fix and resubmit until requirements are met, or move on to a harder project. Struggling learners get another project at the same level before advancing.

The mentor persona is the product: **explain, don't fix.** The AI never silently rewrites your code.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| UI | React (Server + Client Components), Tailwind CSS |
| AI | Provider-agnostic `LLMProvider` interface; Google AI Studio (Gemini 2.5 Flash) by default |
| Validation | Zod (input validation + structured LLM output parsing) |
| Database | Postgres (Neon/Supabase serverless) |
| ORM | Prisma |
| Auth | NextAuth v4 — Google OAuth in production |
| Hosting | Vercel |

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

---

## Architecture at a Glance

A single Next.js app. The browser talks only to server actions / route handlers — all AI and database access happens server-side, behind a provider-agnostic AI service layer.

Four domain modules hold all business rules and depend on nothing but two ports (`AIService` and repositories):

```
src/
  modules/
    project-generator/   # generateProject(context) -> Project
    code-review/         # reviewSubmission(project, code) -> Review
    hint-system/         # nextHint(project, level) -> Hint
    progression/         # evaluateProgress(track, review) -> NextStep
  ai/                    # LLMProvider interface + adapters
  data/                  # Prisma client + repositories
  app/                   # Next.js routes (UI + handlers)
  lib/                   # shared utils, zod schemas, config
```

UI never calls the LLM or database directly. Every LLM response that drives logic is Zod-validated structured output.

---

## MVP Scope

**In scope:** single learner, single track (React), full core loop, progressive hint system (nudge → specific → near-solution → show solution), progress persistence.

**Explicitly out of scope for MVP:** monetization/billing, video/written lessons or a curriculum browser, gamification (XP/badges/streaks), in-app code execution, social/community features, native mobile, multiple technologies at launch.

See [PRD-Learn-By-Building.md](PRD-Learn-By-Building.md) for full goals, non-goals, and success metrics.

---

## Documentation

| Document | Covers |
|---|---|
| [PRD-Learn-By-Building.md](PRD-Learn-By-Building.md) | Requirements, scope, user flow, success metrics |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, module boundaries, data model, tech decisions |
| [ROADMAP.md](ROADMAP.md) | Ordered, independently-testable build tasks and polish phases |
| [AGENTS.md](AGENTS.md) | Operating rules for AI coding agents working in this repo |

These documents are the source of truth — implementation should not contradict them without an explicit, called-out update.

---

## Project Status

All phases are complete: the core build (phases 0–8, [TASKS.md](TASKS.md)) and the polish round (phases 9–14, [ROADMAP.md](ROADMAP.md)). The app is deployed on Vercel at <https://learn-by-building-lilac.vercel.app>, with CI running typecheck, lint, unit tests, build, and the browser smoke suite on every push.

## Local setup

1. Copy `.env.example` to `.env.local` and set every blank value. Keep `NEXTAUTH_URL` as `http://localhost:3001` when using `npm run dev`. For local testing, set `AUTH_DEMO_PASSWORD`; Google OAuth is optional locally.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.

Useful checks:

- `npm run lint`
- `npm run typecheck`
- `npm run format:check`
- `npm run build`

### Browser smoke suite

The focused browser suite covers development credentials, start/resume, pasted code, drag-and-drop files, mentor retry, and the session-expiry return path. GitHub Actions runs it against an isolated Postgres service with `LLM_PROVIDER=fake`, so it never calls Gemini.

1. Start the app against a disposable local or Neon development database after running `npx prisma migrate deploy`. Set `AUTH_DEMO_PASSWORD` and `LLM_PROVIDER=fake` in that server's environment.
2. Install the test browser once with `npx playwright install chromium`.
3. In another terminal, run `SMOKE_BASE_URL=http://localhost:3001 SMOKE_PASSWORD=<the local demo password> SMOKE_FAKE_PROVIDER=true npm run test:smoke`. PowerShell users can set those variables with `$env:` before the command.

Never point this suite at a Preview or Production deployment. It creates learner records and projects. Both local smoke runs and CI use `FakeProvider` and do not call Gemini.

## Troubleshooting core flows

The server writes structured JSON logs for sign-in, project generation, hints,
and code review. Each request has a `requestId`; use that value to follow one
failed request through local terminal output or Vercel Runtime Logs. Logs never
include API keys, passwords, email addresses, or learner-submitted code.

### Local development

1. Confirm `npm run dev` is running on `http://localhost:3001` and
   `NEXTAUTH_URL` uses that exact URL.
2. Clear this app's local cookies and sign in again if a session redirects to a
   different local project. Localhost cookies are shared across ports, so each
   app must keep its own Auth.js cookie names and `NEXTAUTH_URL`.
3. For a failed track start or review, find the matching `request.error` log.
   Its `code` identifies the safe failure category: `unauthorized`,
   `rate_limited`, `ai_unavailable`, `database_unavailable`,
   `configuration_error`, or `invalid_request`.
4. Verify `DATABASE_URL`, `LLM_PROVIDER`, and `GOOGLE_AI_STUDIO_API_KEY` are
   present in the environment used by the running server. Do not paste their
   values into logs, issues, or chat.

### Vercel

1. Confirm the deployment has its own `DATABASE_URL`, Gemini API key,
   `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and an HTTPS
   `NEXTAUTH_URL` that exactly matches the deployed domain.
2. After changing Vercel environment variables, redeploy; existing deployments
   do not receive the new values.
3. Use Vercel Runtime Logs to search for a `requestId`, then correct the
   environment or provider issue indicated by the error code. Share the
   request ID and code with developers, not raw provider responses or secrets.
4. If a review fails, return to the project or use **Retry review**. The local
   draft remains available until a review is saved successfully. If a session
   expires, sign in again from the provided link; the app returns to the
   protected page you were visiting.

---

## Deployment

GitHub Actions runs typecheck, lint, unit tests, and a production build for pull requests and pushes to `main`. A successful push to `main` then runs `prisma migrate deploy` using the repository's `DATABASE_URL_UNPOOLED` GitHub Actions secret.

Import the Git repository as a Vercel project with the default Next.js settings. Do not override the build command: `npm run build` already runs `prisma generate` first. Set `NEXTAUTH_URL` explicitly for every production deployment; do not rely on an automatically supplied Vercel URL for Auth.js configuration.

Set the following Vercel Project Settings environment variables. Add them to both **Preview** and **Production**, using environment-specific values.

| Variable | Value to set |
| --- | --- |
| `DATABASE_URL` | **Pooled** Neon Postgres connection string for that environment. Its hostname includes `-pooler` and it includes `sslmode=require`. Preview must use a separate database from Production. |
| `DATABASE_URL_UNPOOLED` | **Direct** Neon connection string for Prisma migrations only. Do not use it for Vercel runtime traffic. |
| `LLM_PROVIDER` | `google-ai-studio` |
| `LLM_MODEL` | Optional Gemini model override. Leave unset to use `gemini-2.5-flash`. |
| `GOOGLE_AI_STUDIO_API_KEY` | Your Google AI Studio server-side API key. |
| `NEXTAUTH_URL` | Local: `http://localhost:3001`. Preview: the exact HTTPS URL of that preview deployment, preferably as a branch-specific variable. Production: the canonical HTTPS URL, for example `https://your-domain.example`. |
| `NEXTAUTH_SECRET` | A newly generated random secret. Use a different value for Preview and Production. |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 web client ID from Google Cloud. Add the matching deployment callback URL in Google Cloud. |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 web client secret from Google Cloud. Keep it server-side only. |

Set this GitHub Actions repository secret:

| Secret | Value to set |
| --- | --- |
| `DATABASE_URL_UNPOOLED` | The direct Production Postgres connection string. It is used only by the `prisma migrate deploy` job after a successful push to `main`. |

Do not create `VERCEL_URL` yourself; Vercel supplies it. Do not commit `.env`, `.env.local`, or any secret values. After adding or changing Vercel variables, redeploy because variables apply only to new deployments.

Before calling the deployment complete, confirm on the Production URL that you can sign in, start a React track, submit a project, see the review, and unlock the next project.

### Production operations

The production build validates the environment before it runs: Google OAuth credentials, a 32-character-or-longer `NEXTAUTH_SECRET`, an HTTPS `NEXTAUTH_URL`, and a pooled, TLS-enabled Neon runtime URL are all required. A failed validation writes a safe `config.invalid` event to the Vercel build log; it lists only variable names and remediation, never values.

Vercel Runtime Logs provide the baseline operational monitoring. Track `auth.google` and `auth.authorize` outcomes for sign-in failures; `request.complete` and `request.error` by operation for generation, review, and hint outcomes; and `ai.call` for provider latency, retry count, and failures. Reviews include a `verdict`, which supports completion-rate tracking. Every operational event includes a request ID where applicable. Learner code, files, API keys, passwords, and secrets are redacted before logging.

Google OAuth callback URLs must use this exact format:

`[origin]/api/auth/callback/google`

For local development that is `http://localhost:3001/api/auth/callback/google`.
Add the corresponding exact Preview and Production URLs in the Google Cloud OAuth client configuration. The local `AUTH_DEMO_PASSWORD` flow is disabled in production and should not be added to Vercel.

## Release notes

The polish release makes the learner loop more dependable and easier to follow:

- Gemini failures now provide safe, retryable learner feedback and structured owner diagnostics.
- Reviews retain the same presentation while streaming and after refresh, and attempts show visible improvement over time.
- The app has branded loading, error, and not-found states, protected learner routes, security headers, health checks, and browser smoke coverage in CI.
- Drafts, uploads, hints, review feedback, and next-project progression are all preserved through the core loop.

### Three-minute demo

1. Sign in, choose **React**, add a short JavaScript background, and start a track.
2. Submit deliberately incomplete code. Point out the requirement-by-requirement verdict and mentor explanation; the mentor explains what to change rather than rewriting code.
3. Improve the submission and resubmit until the project is complete.
4. Refresh the review page and show **Your attempts**: the earlier attempt, the requirements met, and the completed submission remain visible.
5. Select **Unlock next project**, then open **Your track** to show the higher-level next-project context.

### Release checklist

- [x] Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- [x] Run `npm run test:smoke` only against the isolated local fake-provider environment described above.
- [ ] On a Vercel Preview, verify the deployed Google callback URL is registered, sign in, start or resume a track, paste code, upload source files, receive feedback, and continue progression.
- [ ] Check the primary flow at desktop and narrow mobile widths, with keyboard-only navigation and visible focus indicators.
- [ ] Throttle the browser network and confirm loading, disabled, retry, and saved-draft states remain understandable.
- [ ] Confirm Preview and Production use separate pooled Neon runtime databases; migrations use `DATABASE_URL_UNPOOLED`, and all required variables are present before release.

---

## Future Work

- Additional technology tracks beyond React (TypeScript and Node.js are already visible as locked options in onboarding).
- Submission storage/retention policy and privacy handling for pasted code.
- Prompt tuning and mentor-quality evaluation across models.

Full list in [ARCHITECTURE.md §13](ARCHITECTURE.md#13-key-risks--open-questions).

## License

[MIT](LICENSE)
