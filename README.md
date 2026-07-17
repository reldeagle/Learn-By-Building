# Learn By Building

**Learn By Building** is an AI-mentor coding-education web app. Instead of watching lessons, learners are handed increasingly difficult real projects by an AI mentor, submit their own code, and get concise feedback that *explains* mistakes rather than fixing them. Progression is earned by demonstrated ability, not by chapter number.

> Status: **pre-implementation**. This repo currently contains the product/architecture/roadmap docs only — no application code yet. See [Project Status](#project-status).

---

## Core Loop

**Pick skill → generate project → build → AI review → hints → unlock next.**

1. **Pick a skill** — choose a technology (React only in MVP) and answer a short calibration (prior JS experience, self-rated level).
2. **Generate a project** — the AI produces a right-sized project (~15–30 min) with a goal, a concrete requirements checklist, and an expected outcome.
3. **Build it** — in your own editor (no in-app IDE in MVP).
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

1. Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `LLM_PROVIDER`, and `GOOGLE_AI_STUDIO_API_KEY`.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.

Useful checks:

- `npm run lint`
- `npm run typecheck`
- `npm run format:check`
- `npm run build`

---

## Deployment

GitHub Actions runs typecheck, lint, unit tests, and a production build for pull requests and pushes to `main`. A successful push to `main` then runs `prisma migrate deploy` using the repository's `DATABASE_URL` GitHub Actions secret.

To deploy with Vercel:

1. Import the Git repository as a Vercel project. Vercel automatically detects this as a Next.js application and creates preview deployments for non-production branches.
2. Set these project environment variables for Preview and Production: `DATABASE_URL`, `LLM_PROVIDER=google-ai-studio`, `GOOGLE_AI_STUDIO_API_KEY`, `NEXTAUTH_SECRET`, and `AUTH_DEMO_PASSWORD`.
3. Enable Vercel's Automatically expose System Environment Variables setting. Set `NEXTAUTH_URL` to the production site's canonical HTTPS URL; for preview sign-in testing, set it to that preview deployment's HTTPS URL as a branch-specific Preview variable.
4. Add the production database connection string as the GitHub Actions secret named `DATABASE_URL`, then merge to `main` to run the migration before testing the production deployment.
5. On the deployed production URL, sign in, start a React track, submit a project, confirm the review renders, and unlock the next project.

Do not commit environment files or secrets. Use a separate database for preview deployments so preview migrations and test data cannot affect production.

---

## Key Open Questions

- Auth method (email/password vs. OAuth) — deferred to build phase.
- Submission storage/retention policy and privacy handling for pasted code.
- Final LLM provider/model selection and prompt-tuning strategy.

Full list in [ARCHITECTURE.md §13](ARCHITECTURE.md#13-key-risks--open-questions).
