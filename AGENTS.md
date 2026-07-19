# AGENTS.md

This file defines how you must operate when working in this repository.

These instructions override default tendencies toward over-engineering, unnecessary refactoring, and speculative implementation.

---

# Part A — Project Context

## What This App Is

**Learn By Building** is an AI-mentor coding-education web app. Instead of lessons, the AI gives learners increasingly difficult projects, reviews their submitted code, and gates progression on demonstrated ability.

Core loop: **pick skill → generate project → build → AI review → hints → unlock next.**

The mentor persona is the product: **explain, don't fix.** The AI reviews code by explaining mistakes and the reasoning behind corrections — it never silently rewrites learner code. Keep this persona intact in every prompt, feature, and UX decision.

## Source-of-Truth Documents

Read before making changes. Do not contradict them.

| Document | Authority over |
|---|---|
| `PRD-Learn-By-Building.md` | Requirements, scope, non-goals, success metrics |
| `ARCHITECTURE.md` | System design, module boundaries, data model, tech decisions |
| `ROADMAP.md` | Task order and granularity |

If a requested change requires deviating from these documents, say so and propose the document update — do not silently diverge.

## Stack (fixed — do not swap or add alternatives)

- **Next.js (App Router) + TypeScript** — one full-stack codebase
- **Tailwind CSS** — styling
- **Zod** — input validation AND structured LLM output parsing (one schema source)
- **Prisma + Postgres** (Neon/Supabase serverless) — data
- **NextAuth v4** — sessions (Google OAuth in production)
- **Provider-agnostic `LLMProvider` interface**, Google AI Studio (Gemini 2.5 Flash) as default adapter
- **Vercel** — hosting

## Architecture Rules

1. Business rules live ONLY in the four domain modules: `src/modules/project-generator`, `code-review`, `hint-system`, `progression`. They depend on two ports — the AI service and repositories — and nothing else.
2. UI never calls the LLM or database directly. All access goes through server actions or route handlers.
3. Every LLM response that drives logic is Zod-validated structured output (`ProjectSchema`, `ReviewSchema`, ...). Free text is for display only.
4. Validate every boundary with Zod. Never trust client-side validation.
5. API keys and secrets are server-side only. Nothing secret ships to the client.
6. Code review grades against the project's explicit requirement list — completion verdicts must be deterministic and defensible, not vague model impressions.
7. Follow the folder layout in `ARCHITECTURE.md` §4. Do not reorganize it.

**Sanctioned abstractions:** the `LLMProvider` interface, the four module ports, and the repository layer are deliberate architecture seams — use them. Do NOT add new interfaces, factories, or abstraction layers beyond these without explicit approval (see Rule 8 below).

## Project Conventions

- One roadmap task = one small, independently testable change. Work in that granularity.
- Tests use `FakeProvider` (fixed schema-valid JSON). Never call a live LLM in tests or CI.
- Prompt templates live in `src/ai/prompts/` and are versioned in code.
- All AI-calling endpoints are rate-limited and auth-gated.

---

# Part B — Operating Rules

## Core Principle

Your job is not to write the most code.

Your job is to solve the requested problem with the smallest, clearest, and most maintainable change possible.

Optimize for correctness, simplicity, and readability.

## 1. Think Before Coding

Never jump straight into implementation.

Before making changes:

- Understand the actual problem.
- Read surrounding code before editing.
- Identify existing patterns and follow them.
- State important assumptions.
- If requirements are ambiguous, ask instead of guessing.
- If multiple reasonable interpretations exist, present them.
- If a simpler solution exists, recommend it.
- Push back on unnecessary complexity.

Never silently choose between multiple interpretations. When unsure, stop and ask.

## 2. Simplicity First

Prefer the simplest solution that completely solves the problem.

Do NOT:

- add features that weren't requested
- build future-proof abstractions
- introduce configuration that isn't needed
- optimize without evidence
- create generic utilities for one use case
- write defensive code for impossible situations

Every abstraction must justify its existence. If the implementation feels clever, it is probably too complicated.

Ask yourself: *Would an experienced engineer remove code from this solution?* If yes, simplify.

## 3. Surgical Changes

Make focused, minimal diffs. Only modify code required for the requested task.

Do NOT:

- refactor unrelated code
- rename things unnecessarily
- reformat unrelated files
- rewrite code because you prefer another style
- reorganize files unless requested

Respect the existing codebase. If existing patterns are reasonable, follow them.

## 4. Clean Up Only Your Own Changes

If your changes create unused imports, unused variables, dead functions, or unreachable code — remove them.

Do not clean up unrelated technical debt. If unrelated problems are discovered, mention them separately instead of fixing them.

## 5. Match Existing Conventions

Before introducing new patterns:

- inspect similar files
- reuse existing utilities
- reuse existing architecture
- follow naming conventions
- follow project structure

Consistency is more valuable than personal preference.

## 6. Goal-Driven Execution

Translate requests into measurable outcomes.

Instead of "fix authentication," think:

1. reproduce the issue
2. identify the cause
3. implement the fix
4. verify authentication succeeds
5. verify existing behavior still works

For larger work, briefly state your plan before implementing. Whenever possible, verify your work. Prefer evidence over confidence.

## 7. Verify Before Declaring Success

Never assume code works.

Whenever practical:

- run tests
- update tests if behavior changed
- verify types compile (`tsc --noEmit`)
- check linting
- verify edge cases introduced by the change

Do not claim something works unless it has been verified — or clearly state that it has not been.

## 8. Avoid Over-Engineering

Do not introduce factories, builders, dependency injection, new interfaces, custom hooks, or utility functions unless there is an actual need.

Exception: the sanctioned architecture seams listed in Part A already exist by design — implement against them; do not duplicate or bypass them.

Duplication is acceptable when it keeps the code simpler. Extract abstractions only after patterns genuinely emerge.

## 9. Communication

Be concise. Explain:

- what changed
- why it changed
- any assumptions
- any limitations

Avoid unnecessary narration. If you cannot confidently proceed, ask a question instead of guessing.

## 10. Decision Priority

Optimize in this order:

1. Correctness
2. Simplicity
3. Readability
4. Maintainability
5. Performance
6. Flexibility

Do not sacrifice simplicity for hypothetical future requirements.

## 11. Error Handling

Handle realistic failures — for this app that means: LLM timeouts, invalid/partial model output, oversized code submissions, and unauthorized access. These are expected, not exceptional.

Do not write defensive code for situations that cannot occur. Prefer explicit failures over silently hiding problems. Error messages should help developers identify the issue quickly. Never surface raw stack traces or provider errors to learners.

## 12. Dependencies

Before adding a dependency:

- check if the standard library solves it
- check if the project already uses something similar (Zod, Prisma, Tailwind cover a lot)
- justify why a new dependency is necessary

Avoid dependency growth.

## 13. Refactoring

Refactor only when:

- it directly supports the requested task
- it removes duplication created by your work
- it significantly improves clarity

Avoid drive-by refactors.

## 14. Comments

Prefer code that explains itself. Write comments only for intent, reasoning, non-obvious decisions, or important constraints. Do not narrate obvious code.

## 15. File Size

Prefer cohesive, focused files. Avoid unnecessarily large files, but also avoid splitting small, understandable code across many files. Optimize for readability.

## 16. Be Honest

Never pretend certainty. Clearly distinguish between facts, assumptions, and inferences.

If something cannot be verified, say so. If there are tradeoffs, explain them. If there is a better approach than the one requested, suggest it before implementing.

---

# Definition of Done

A task is complete when:

- the requested problem is solved
- no unnecessary code was introduced
- the implementation matches existing project conventions
- types remain correct
- tests were updated or added when appropriate
- no unused code remains from the change
- assumptions and limitations have been communicated

Stop when the requested outcome is achieved. Do not continue improving unrelated parts of the codebase.
