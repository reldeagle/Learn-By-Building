# Implementation Roadmap — Learn By Building

Smallest-possible, independently-testable tasks (~30–60 min each), ordered so each builds on the last.
Companion docs: `PRD-Learn-By-Building.md`, `ARCHITECTURE.md`.

---

## Phase 0 — Project Setup

1. Initialize a Next.js (App Router) + TypeScript project; verify dev server renders the default page. *(Test: `npm run dev` loads at localhost.)*
2. Add Tailwind CSS; verify a styled utility class renders on the home page. *(Test: a colored element appears.)*
3. Configure ESLint + Prettier + strict `tsconfig`; verify lint and typecheck pass on a clean tree. *(Test: `npm run lint` and `tsc --noEmit` pass.)*
4. Add the `src/` folder skeleton from the architecture (`modules/`, `ai/`, `data/`, `lib/`, `app/`) with placeholder index files. *(Test: build succeeds with empty modules.)*
5. Add environment config loader in `src/lib/config.ts` reading `DATABASE_URL`, `LLM_PROVIDER`, provider key; fail fast if missing. *(Test: unit test throws on missing var, passes when set.)*

## Phase 1 — Database Layer

6. Install Prisma; initialize schema and connect to a local/serverless Postgres. *(Test: `prisma db push` connects successfully.)*
7. Define `User` and `Track` models + migration. *(Test: migrate; create a user+track via Prisma Studio/script.)*
8. Define `Project` and `Requirement` models + relations + migration. *(Test: create a project with two requirements.)*
9. Define `Submission`, `Review`, and `HintUnlock` models + relations + migration. *(Test: create a submission→review row pair.)*
10. Create a singleton Prisma client in `src/data/client.ts` (serverless-safe). *(Test: import returns one instance across calls.)*
11. Write a `TrackRepository` (create, getByUser, updateLevel). *(Test: unit test each method against a test DB.)*
12. Write a `ProjectRepository` (create with requirements, getActive, markComplete). *(Test: unit test CRUD + status transition.)*
13. Write `SubmissionRepository` + `ReviewRepository` (save submission, save review, list attempts). *(Test: save and read back an attempt with its review.)*
14. Write a `HintRepository` (getCurrentLevel, recordUnlock). *(Test: unlock increments level correctly.)*

## Phase 2 — Shared Schemas & Validation

15. Define Zod `ProjectSchema` (goal, requirements[], expectedOutcome, hints[]). *(Test: valid object parses; malformed throws.)*
16. Define Zod `ReviewSchema` (verdict, requirementStatus[], feedback[]). *(Test: valid/invalid cases.)*
17. Define Zod `LearnerContextSchema` and `HintSchema`. *(Test: parse round-trip.)*
18. Define API input schemas (`startTrack`, `requestHint`, review request body). *(Test: reject bad payloads.)*

## Phase 3 — AI Service Layer

19. Define the `LLMProvider` interface (`complete<T>`, `stream`) and `CompletionRequest` type in `src/ai/llm-provider.ts`. *(Test: type-only; compiles.)*
20. Implement a `FakeProvider` returning fixed schema-valid JSON for tests. *(Test: `complete` returns parsed object.)*
21. Implement `GoogleAIStudioProvider.complete` (Gemini 2.5 Flash, JSON output, Zod validation, one repair retry). *(Test: mock HTTP; valid + repair paths.)*
22. Implement `GoogleAIStudioProvider.stream` (token stream). *(Test: mock stream yields tokens in order.)*
23. Add provider selection factory reading `LLM_PROVIDER` config. *(Test: returns Fake vs Google AI Studio by env.)*
24. Add timeout + bounded-retry + `maxTokens` wrapper around provider calls. *(Test: simulated timeout triggers retry then error.)*
25. Create versioned prompt templates dir `src/ai/prompts/` with the mentor system prompt. *(Test: template loads; contains persona rules.)*

## Phase 4 — Domain Modules

26. Implement Project Generator: `generateProject(context)` using AIService + `ProjectSchema`. *(Test: with FakeProvider, returns a valid Project.)*
27. Implement Code Review: `reviewSubmission(project, code)` returning `ReviewSchema`, grading against the requirement list. *(Test: FakeProvider verdict paths — complete / needs_work.)*
28. Implement Hint System: `nextHint(project, level)` returning escalating hint, `isSolution` at final level. *(Test: levels 1→3 then solution.)*
29. Implement Progression Engine: `evaluateProgress(track, review)` → unlock-next vs repeat-same-level (`difficultyDelta`). *(Test: complete advances; repeated needs_work stays.)*

## Phase 5 — API Surface

30. Add Auth.js (NextAuth) with a placeholder credentials/email provider + session helper. *(Test: unauthenticated request is rejected.)*
31. Implement `startTrack` server action (validate → create track → seed first project). *(Test: creates track + Project 1.)*
32. Implement `requestNextProject` server action (Progression → Generator → persist). *(Test: returns a harder project after completion.)*
33. Implement `POST /api/review` route handler with streaming feedback + final Review persist. *(Test: SSE emits tokens, DB has Review.)*
34. Implement `requestHint` server action (repo level + Hint System + record unlock). *(Test: sequential calls escalate + record.)*
35. Add per-user rate limiting to AI endpoints (generation, review, hints). *(Test: N+1th call in window is blocked.)*
36. Enforce ownership/authorization scoping on every read/write. *(Test: user B cannot access user A's project.)*

## Phase 6 — Frontend

37. Build the Onboarding/Skill-Select screen (technology + 2 calibration questions) wired to `startTrack`. *(Test: submitting routes to Project 1.)*
38. Build the Active Project screen (goal, requirements checklist, expected outcome) as a server component. *(Test: renders seeded project data.)*
39. Build the code submission form (paste + file upload) posting to `/api/review`. *(Test: submit sends code; size limit enforced.)*
40. Build the streaming Review result view (incremental feedback + per-requirement status + verdict). *(Test: tokens render live; verdict shows.)*
41. Wire the "Improve & resubmit" vs "Unlock next project" branch from the verdict. *(Test: each verdict shows correct CTA + action.)*
42. Build the Hint control (reveal one level at a time, then "Show solution"). *(Test: each click reveals exactly one level.)*
43. Build the Track/Progress screen (completed + upcoming projects, re-enter active). *(Test: reflects DB state; links work.)*

## Phase 7 — Cross-Cutting & Hardening

44. Add typed error handling + graceful AI-failure UI (retry affordance, no raw stack). *(Test: forced provider error shows friendly retry.)*
45. Add structured request + AI-call logging (latency, tokens, retries, verdict). *(Test: a review call emits one structured log line.)*
46. Add thumbs up/down on reviews persisted for prompt tuning. *(Test: feedback saved against the review.)*
47. Write end-to-end happy-path test: onboarding → build → review complete → unlock next. *(Test: E2E passes with FakeProvider.)*

## Phase 8 — Deployment

48. Add CI pipeline: typecheck → lint → unit tests → build → Prisma migrate. *(Test: pipeline green on a PR.)*
49. Configure Vercel project + env vars (provider key, DB URL, auth secrets) with preview deploys. *(Test: preview URL runs the app.)*
50. Run production migration + smoke test the full loop on the deployed URL. *(Test: complete one project end-to-end in prod.)*
