# Learn By Building — Polish Roadmap

Goal: take the app from "works but rough" to a professional, user-ready product. Fix the broken AI mentor loop first, then make the experience cohesive, then add a minimal set of depth features, then harden for release.

This roadmap continues the numbering in `TASKS.md` (which ends at Phase 8, task 50): phases 9–14, tasks 51–78. Supersedes `POLISH_IMPLEMENTATION_PLAN.md` (the previous polish round, already implemented).

Legend: `- [ ]` not started · `- [~]` in progress · `- [x]` done. Effort: S = hours, M = a day or two.

---

## Diagnosis quick-start — why the AI mentor review fails (read first)

The review and project generation share one code path: `createLLMProvider()` (`src/ai/provider.ts`) → `GoogleAIStudioProvider.complete()` (`src/ai/google-ai-studio-provider.ts`). When this path fails, **both** the mentor review and onboarding (first project generation) fail. Ranked root-cause candidates for local failure:

1. **Env config** — `LLM_PROVIDER` must be *exactly* `google-ai-studio` or `fake` (`src/lib/config.ts:17`, strict zod enum — `gemini`, `google`, or blank all throw `ConfigurationError` → 503 "The service is not configured correctly" for ALL AI). `GOOGLE_AI_STUDIO_API_KEY` must be non-empty AND valid for a Google project with the Generative Language API enabled.
2. **Thinking-token budget (most likely if config is right)** — the request sends `maxOutputTokens: 1200` with **no `thinkingConfig`** (`google-ai-studio-provider.ts:318-329`). `gemini-2.5-flash` is a thinking model: hidden thinking tokens count against that 1200 cap, so the model can exhaust the budget and return zero visible parts → `"Google AI Studio returned an empty response."` (line 283) → "Your mentor is unavailable right now." **every time**.
3. **Diagnostics blind spot compounding both** — on failure the provider throws away the HTTP status and body (lines 334-338) and logs only a `retryable` boolean, so bad key (401), bad model (404), and quota (429) all look identical. Fixing this first (task 55) turns every later attempt into a data point.

---

## Phase 9 — Baseline & repo hygiene (Effort: S)

- [ ] 51. **Restore edited-in-place migrations.** `git status` shows uncommitted edits to `prisma/migrations/20260717102500_init/migration.sql` and `20260716232341_add_project_hints/migration.sql` (the hints column was folded into init). Applied migrations are checksum-verified — `prisma migrate deploy` (run by CI on main, `.github/workflows/ci.yml:45`) will fail with drift against any database that already ran the originals. Fix: `git restore prisma/migrations/`. Done when: `npx prisma migrate deploy` reports no pending migrations and no drift.
- [ ] 52. **Triage the dirty working tree.** Review modified `FRONTEND.md`, `Submitting_info.md`, deleted `IMPLEMENTATION-ROADMAP.md`, untracked `.agents/`, `.neon`, `skills-lock.json`; commit what belongs, gitignore local-only files (`.neon` especially — don't commit potential credentials). Done when: `git status` is clean.
- [ ] 53. **Fake-provider baseline.** Run the full loop locally with `LLM_PROVIDER=fake` (sign in with dev credentials → onboard → submit → review → unlock) plus `npm run typecheck && npm run lint && npm test`. Proves everything except Gemini works, isolating Phase 10 to the provider. Done when: loop completes on `localhost:3001` and all checks are green.

## Phase 10 — AI mentor recovery (Effort: M)

A diagnostic ladder — each rung is cheap and narrows the fault before the next.

- [ ] 54. **Verify env config (no code changes).** Confirm `LLM_PROVIDER=google-ai-studio` exactly (no quotes/whitespace) and the API key is non-empty and valid — test it with a direct curl to the Gemini API. Done when: failures no longer say "not configured correctly".
- [ ] 55. **Instrument the provider.** In `fetchResponse` (`google-ai-studio-provider.ts:334-339`): on `!response.ok`, read a truncated response body and include the status + Google's error message in the `AIServiceError`; extend the `ai.error` log events (lines 187-191) with status/cause; log zod issue summaries when `parseStructuredResponse` fails (lines 365-376). Never log the API key or learner code. Done when: a forced bad key produces a log naming HTTP 400/401 and Google's reason string.
- [ ] 56. **Fix the thinking-token budget (prime suspect).** Add `thinkingConfig: { thinkingBudget: 0 }` to `generationConfig`; raise `maxTokens` — generation to ~3000 (`src/modules/project-generator/index.ts`; a project plus progressive hints plus a solution hint doesn't fit 1200 tokens) and review to ~2000 (`src/modules/code-review/index.ts`). Done when: a real-key local run generates a project and completes a review; logs show success.
- [ ] 57. **Make the model configurable.** Optional `LLM_MODEL` env (default `gemini-2.5-flash`) in `src/lib/config.ts`, threaded through `createLLMProvider()` (`src/ai/provider.ts`) to the constructor's existing model param (`google-ai-studio-provider.ts:127`). Recovery from model deprecation becomes an env change, not a deploy. Done when: setting `LLM_MODEL` visibly changes the request URL (via task 55 logging) and default behavior is unchanged when unset.
- [ ] 58. **Strengthen structured-output repair.** The exact-index-bijection rule in `createReviewEvaluationSchema` (`src/lib/schemas.ts:94-120`) lives in a `superRefine` that can't be expressed in the JSON schema sent to Gemini; the single repair retry sends only a generic "did not match" message. Include the concrete zod issues in the repair prompt. Done when: a unit test shows the repair request contains the specific issue text.
- [ ] 59. **Pre-deploy runtime budget (Vercel).** Export `maxDuration = 60` from `src/app/api/review/route.ts` and the pages whose server actions call AI (`src/app/(onboarding)/start/page.tsx`, `src/app/project/[id]/review/page.tsx`); the 30s provider timeout plus a repair retry exceeds Vercel Hobby's 10s default → truncated SSE stream → "Review ended before a result was available." Also add a periodic SSE heartbeat progress event (~every 10s) in the review stream, since nothing is emitted between "Reading your submission" and completion. Do this before any deploy.
- [ ] 60. **End-to-end AI verification.** Full loop (onboard → generate → submit → review → unlock → second project) with real Gemini, twice in a row, locally — and on the deployed URL once deployed.

## Phase 11 — Flow & cohesion fixes (Effort: M)

- [ ] 61. **Unify the review UI.** The streamed result (`src/components/review-stream.tsx` `StreamedReview`, lines 13-95, duplicated markup) looks different from the persisted result (`src/app/project/[id]/review/page.tsx` `PersistedReview`, which uses `src/components/project-ui.tsx`) — the same review changes appearance on refresh. This is the single clearest "doesn't flow" defect. Render `VerdictBanner`/`RequirementRow`/`FeedbackItem` in both. Done when: streamed and refreshed views of one review are identical.
- [ ] 62. **Global error surfaces.** Add root `src/app/error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx`, plus boundaries for `/signin`, styled like `src/app/track/error.tsx`. Home (`src/app/page.tsx`) does session + DB queries with no boundary; `notFound()` calls currently render the unstyled default 404. Done when: a DB outage on `/` and a bogus `/project/xyz` both show branded pages.
- [ ] 63. **Rate limit after validation.** `requestNextProject` consumes the 5/min generation budget before the active-project 409 check (`src/app/actions/learning.ts:207-216`); same pattern in the review route (`src/app/api/review/route.ts:154` vs 157-186). Reorder so limits are only consumed for eligible requests. Done when: tests assert no bucket increment on 404/409 paths.
- [ ] 64. **No orphan Submission rows.** `saveSubmission` runs before the `saveReviewAndUpdateProject` transaction (`route.ts:211-237`); if the project went inactive mid-review, a Submission persists with no Review. Move the insert inside the transaction (`src/data/repositories.ts:256-321`). Done when: a test simulating a project completed mid-review leaves zero new Submission rows.
- [ ] 65. **Hint dead-end.** `HintControl` shows "Show solution" even when `hints` is empty (`src/components/hint-control.tsx:84-88`) but `nextHint` then throws (`src/modules/hint-system/index.ts:23`) → a guaranteed error message. Hide the hint UI when hints are empty; offer "Show solution" only when a solution hint exists. Done when: a project seeded with `hints: []` shows no hint UI and normal projects still escalate to solution.
- [ ] 66. **AccountMenu popover.** Replace `<details>/<summary>` (`src/components/account-menu.tsx:23`) with a button + controlled panel that closes on outside click and Escape, with `aria-expanded`. Done when: keyboard-only operation works and the menu closes on outside click/Escape.

## Phase 12 — Depth features (Effort: M)

A minimal set chosen for depth-per-effort. Explicitly **skip** PRD Feature 5 (challenges / `Project.kind`): the PRD calls it optional fast-follow and it forks the data model.

- [ ] 67. **Submission history ("Your attempts").** The data already exists — every attempt is persisted, `SubmissionRepository.listAttempts` is written but unused, and `ARCHITECTURE.md` §6 already promises an improvement history. Show a chronological attempt list on the persisted review page: attempt #, date, verdict, requirements met (x/y from stored `requirementStatus`) — e.g. "Attempt 1 · 2/5 met → Attempt 2 · 5/5 · Complete". This directly dramatizes the product's core claim: the mentor makes you improve. **Add user scoping to `listAttempts`** (it currently filters by projectId only — safe today only because callers pre-verify ownership; make it safe by construction). Files: `src/app/project/[id]/review/page.tsx`, `src/data/repositories.ts`, `src/components/project-ui.tsx`. Done when: a project with 2+ attempts shows the history and a user cannot retrieve another user's attempts.
- [ ] 68. **Honest next-unlock preview.** Replace the placeholder "Next React project" card (`src/app/track/page.tsx:114-128`) with real track state: upcoming level, that it's generated on completion, and what it builds on. No speculative AI call — that would burn quota. Done when: the card shows level and context derived from live track data.
- [ ] 69. **Health endpoint.** `GET /api/health` → `{ status, checks: { database, config } }` via a cheap `SELECT 1` (`src/data/client.ts`) + `getConfig()` pass/fail; 200 healthy / 503 otherwise; no secrets, no model/key detail. Doubles as a permanent diagnostic for the Phase 10 class of failures (promised in the old polish plan, never built). Files: new `src/app/api/health/route.ts`. Done when: healthy returns 200, DB-down returns 503 with `database: "fail"`, and the response leaks no env values.
- [ ] 70. **Draft persistence polish.** Verify the existing local draft in `src/components/code-input.tsx` survives reload and navigation; add a subtle "Draft saved" indicator and a "Discard draft" action. Done when: typed code survives reload, discard clears storage, and a successful review still clears the draft.

## Phase 13 — Professional polish & ops (Effort: M)

- [ ] 71. **Security headers.** `next.config.ts` is empty: add `poweredByHeader: false` and a `headers()` block (X-Content-Type-Options, Referrer-Policy, frame-ancestors, Permissions-Policy). Done when: headers visible in a deployed response, app unchanged.
- [ ] 72. **Auth middleware.** Add `src/middleware.ts` (NextAuth v4 `withAuth`) for `/start`, `/project/:path*`, `/track` as defense-in-depth; keep per-page `requireUser()` for authorization. Today protection is purely per-page — any future page must remember to opt in. Done when: signed-out access redirects to `/signin?callbackUrl=…` without rendering, and `auth-redirect` tests still pass.
- [ ] 73. **Contrast polish.** Raise the `text-slate-500` counters (`src/components/onboarding-form.tsx:150`, `src/components/code-input.tsx:292`) to pass WCAG contrast on the slate-950 background. Done when: Lighthouse a11y contrast passes on home, project, review, and track.
- [ ] 74. **Remove dead repository code.** Delete `TrackRepository.updateLevel`, `ProjectRepository.updateRequirementStatus`, `ProjectRepository.markComplete` (`src/data/repositories.ts` — superseded by the review transaction; referenced only by test mocks). Keep `listAttempts` (now used by task 67). Done when: typecheck and tests are green with the methods removed.
- [ ] 75. **Smoke suite in CI.** The 5 Playwright flows (`e2e/smoke.spec.ts`) never run in CI, so browser coverage can silently rot. Add a CI job: Postgres service container → `prisma migrate deploy` → build and start with `LLM_PROVIDER=fake` → `npm run test:smoke` with `SMOKE_BASE_URL=http://localhost:3001`, `SMOKE_FAKE_PROVIDER=true`, `SMOKE_PASSWORD`/`AUTH_DEMO_PASSWORD`. Done when: the 5 smoke flows run green in CI on a PR.
- [ ] 76. **Doc sync.** Update `TASKS.md`: phases 6–8 ARE done despite being unchecked — check them and fix the progress counter; repoint the dead `IMPLEMENTATION-ROADMAP.md` link (line 3) to this file; append phases 9–14. Fix `AGENTS.md` (claims an Anthropic/Claude adapter; the code is Gemini) and the "Auth.js" naming (the dependency is NextAuth v4). Document `AUTH_DEMO_PASSWORD` and the new `LLM_MODEL` in README/.env.example. Done when: every doc reference resolves and a fresh reader can set up the app from the README alone.

## Phase 14 — Verification & release (Effort: S)

- [ ] 77. **Full verification matrix.** All four columns pass: (1) local fake provider — full loop + hints + attempt history + health 200; (2) local real Gemini — onboard → needs_work → improve → complete → unlock, no `ai.error` logs; (3) deployed — same loop via Google OAuth, a >10s review completes, health 200, security headers present; (4) CI — typecheck, lint, unit, build, smoke all green; `prisma migrate deploy` clean.
- [ ] 78. **Release notes + 3-minute demo script.** Short section in the README: what changed, and how to demo the loop — onboard → submit flawed code → read mentor feedback → resubmit → history shows improvement → unlock next project.

---

## Definition of done (whole effort)

- A new user goes from sign-in to a completed second project with zero unbranded error screens, on real Gemini.
- Any AI failure shows a branded, retryable message to the learner AND a log line naming the HTTP status/cause for the owner.
- Reviews render identically streamed and persisted; every route has error/loading/404 coverage.
- Attempt history visibly shows improvement; hints never dead-end; no orphan rows; rate limits only consumed for eligible requests.
- CI is green including browser smoke; `git status` clean; migrations deploy without drift; docs match the code.
