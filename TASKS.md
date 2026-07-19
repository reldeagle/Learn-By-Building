# Tasks — Learn By Building

Live progress tracker. Full task detail and test criteria live in [ROADMAP.md](ROADMAP.md) — task numbers here map 1:1 to that doc.

**Legend:** `- [ ]` not started · `- [~]` in progress · `- [x]` done

**Core implementation progress:** 50 / 50 complete

---

## Phase 0 — Project Setup
- [x] 1. Initialize Next.js (App Router) + TypeScript
- [x] 2. Add Tailwind CSS
- [x] 3. Configure ESLint + Prettier + strict tsconfig
- [x] 4. Add `src/` folder skeleton (modules, ai, data, lib, app)
- [x] 5. Env config loader in `lib/config.ts` (fail fast on missing vars)

## Phase 1 — Database Layer
- [x] 6. Install Prisma; init schema + connect to Postgres
- [x] 7. `User` + `Track` models + migration
- [x] 8. `Project` + `Requirement` models + relations + migration
- [x] 9. `Submission`, `Review`, `HintUnlock` models + relations + migration
- [x] 10. Singleton Prisma client in `data/client.ts` (serverless-safe)
- [x] 11. `TrackRepository` (create, getByUser)
- [x] 12. `ProjectRepository` (create with requirements, getActive)
- [x] 13. `SubmissionRepository` + `ReviewRepository`
- [x] 14. `HintRepository` (getCurrentLevel, recordUnlock)

## Phase 2 — Shared Schemas & Validation
- [x] 15. Zod `ProjectSchema`
- [x] 16. Zod `ReviewSchema`
- [x] 17. Zod `LearnerContextSchema` + `HintSchema`
- [x] 18. API input schemas (startTrack, requestHint, review body)

## Phase 3 — AI Service Layer
- [x] 19. `LLMProvider` interface + `CompletionRequest` type
- [x] 20. `FakeProvider` (fixed schema-valid JSON for tests)
- [x] 21. `GoogleAIStudioProvider.complete` (Gemini 2.5 Flash, Zod validation, repair retry)
- [x] 22. `GoogleAIStudioProvider.stream` (token stream)
- [x] 23. Provider selection factory (reads `LLM_PROVIDER`)
- [x] 24. Timeout + bounded-retry + `maxTokens` wrapper
- [x] 25. Versioned prompt templates dir + mentor system prompt

## Phase 4 — Domain Modules
- [x] 26. Project Generator: `generateProject(context)`
- [x] 27. Code Review: `reviewSubmission(project, code)` (grades vs requirements)
- [x] 28. Hint System: `nextHint(project, level)` (escalating + solution)
- [x] 29. Progression Engine: `evaluateProgress(track, review)`

## Phase 5 — API Surface
- [x] 30. NextAuth v4 + session helper
- [x] 31. `startTrack` server action (validate → create track → seed Project 1)
- [x] 32. `requestNextProject` server action (Progression → Generator → persist)
- [x] 33. `POST /api/review` route handler (streaming + persist Review)
- [x] 34. `requestHint` server action (level + Hint System + record unlock)
- [x] 35. Per-user rate limiting on AI endpoints
- [x] 36. Ownership/authorization scoping on every read/write

## Phase 6 — Frontend
- [x] 37. Onboarding / Skill-Select screen wired to `startTrack`
- [x] 38. Active Project screen (server component)
- [x] 39. Code submission form (paste + file upload)
- [x] 40. Streaming Review result view (feedback + per-requirement status + verdict)
- [x] 41. "Improve & resubmit" vs "Unlock next" branch
- [x] 42. Hint control (reveal one level at a time, then Show solution)
- [x] 43. Track / Progress screen

## Phase 7 — Cross-Cutting & Hardening
- [x] 44. Typed error handling + graceful AI-failure UI
- [x] 45. Structured request + AI-call logging
- [x] 46. Thumbs up/down on reviews (persisted)
- [x] 47. End-to-end happy-path test (with FakeProvider)

## Phase 8 — Deployment
- [x] 48. CI pipeline (typecheck → lint → tests → build → migrate)
- [x] 49. Vercel project + env vars + preview deploys
- [x] 50. Production migration + smoke test the full loop

## Polish Roadmap — Phases 9–14

- [~] Phase 9 — Baseline & repo hygiene
- [~] Phase 10 — AI mentor recovery
- [x] Phase 11 — Flow & cohesion fixes
- [x] Phase 12 — Depth features
- [x] Phase 13 — Professional polish & ops
- [ ] Phase 14 — Verification & release

See [ROADMAP.md](ROADMAP.md) for tasks 51–78 and their release criteria.
