# Learn By Building

**Learn By Building** is an AI-mentor coding-education web app. Instead of watching lessons, learners are handed increasingly difficult real projects by an AI mentor, submit their own code, and get concise feedback that *explains* mistakes rather than fixing them. Progression is earned by demonstrated ability, not by chapter number.

> Status: **core learner loop implemented**. See [Project Status](#project-status) and [Troubleshooting](#troubleshooting-core-flows) before reporting a local or deployment issue.

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
| Auth | Auth.js (NextAuth) — concrete provider TBD |
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
| [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md) | Ordered, independently-testable build tasks |
| [AGENTS.md](AGENTS.md) | Operating rules for AI coding agents working in this repo |

These documents are the source of truth — implementation should not contradict them without an explicit, called-out update.

---

## Project Status

Phases 0 through 8 are complete. The application is ready for CI and Vercel deployment after the required environment variables and database are configured.

## Local setup

1. Copy `.env.example` to `.env.local` and set every blank value. Keep `NEXTAUTH_URL` as `http://localhost:3001` when using `npm run dev`. For local testing, set `AUTH_DEMO_PASSWORD`; Google OAuth is optional locally.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.

Useful checks:

- `npm run lint`
- `npm run typecheck`
- `npm run format:check`
- `npm run build`

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

---

## Key Open Questions

- Google OAuth client configuration for local, Preview, and Production callback URLs.
- Submission storage/retention policy and privacy handling for pasted code.
- Final LLM provider/model selection and prompt-tuning strategy.

Full list in [ARCHITECTURE.md §13](ARCHITECTURE.md#13-key-risks--open-questions).
