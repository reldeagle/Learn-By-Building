# PRD — Learn By Building

**Document type:** Product Requirements Document
**Product:** Learn By Building
**Version:** 0.1 (MVP)
**Date:** 2026-07-16
**Scope:** Lean MVP · Web app · Monetization deferred (out of scope)

---

## Context

Most programming education is passive: learners watch videos, copy tutorials, and complete guided exercises, yet still freeze when asked to build something from scratch. The gap is not knowledge of syntax — it's the ability to *apply* it independently.

**Learn By Building** closes that gap by inverting the model. Instead of lessons, an AI mentor hands the learner a series of increasingly difficult real projects. The learner writes the code, submits it, and gets concise mentor-style feedback that explains mistakes rather than fixing them. Progression is earned by demonstrated ability, not by chapter number.

This PRD defines the **lean MVP**: the smallest version that delivers the core loop end-to-end for a single learner and a single starting technology (React), on the web.

---

## Goals & Non-Goals

### Goals
- Deliver the complete core loop: **pick skill → generate project → build → AI review → hints → unlock next**.
- Make the AI feel like a *mentor* (explains, nudges, encourages) not an *autograder* (pass/fail, auto-rewrites).
- Persist a learner's progress so they can leave and return to their track.
- Keep the interface simple: one focused screen for the active project.

### Non-Goals (explicitly out of scope for MVP)
- Monetization / billing / paywalls.
- Video content, written lessons, or a curriculum browser.
- Gamification beyond "unlock the next project" (no XP, badges, streaks, leaderboards).
- Live code execution / sandboxed running of user code in-app.
- Social features, sharing, collaboration, or community.
- Native mobile apps.
- Multiple technologies at launch (architecture should not *preclude* them, but only **React** ships in MVP).

---

## Target Users

- **Primary:** Aspiring/early developers who have finished tutorials but can't yet build independently. They know *some* JavaScript and want to become someone who can build React apps.
- **Secondary:** Self-taught developers filling gaps, and career-switchers who learn best by doing.

**Assumed context:** learners write code in their own editor (VS Code, etc.) and paste or upload it back into the app. The MVP does **not** provide an in-app IDE.

---

## Core User Flow

1. **Pick a skill.** Learner selects a technology (React in MVP). AI asks 1–2 calibration questions (prior JS experience; self-rated level: beginner / intermediate / experienced).
2. **Generate the first project.** AI produces a small project (15–30 min) sized to the learner's level — e.g. Counter app.
3. **Build it.** The learner sees goal, requirements, and expected outcome. Hints are available on demand but not shown by default. The learner writes code in their own editor.
4. **Submit for review.** Learner pastes or uploads their code. AI reviews for correctness, bugs, readability, and best practices — **explaining** issues, not silently rewriting.
5. **Improve.** If incomplete, the AI points to what to fix (with the *why*). Learner resubmits. Loop until the project meets its requirements.
6. **Unlock the next project.** On completion, the AI generates the next, slightly harder challenge. If the learner struggled, it generates another project targeting the *same* skill before advancing.

### Example difficulty progression (React track)
Counter → Todo List → Notes App → Weather Dashboard → Recipe Finder → Expense Tracker → Small E-commerce Frontend

---

## Features (MVP)

### 1. Skill Selection & Calibration
- Select technology (React only in MVP; UI should present it as one of a list to be extended later).
- AI asks a short (≤2 question) calibration set.
- Output: an initial difficulty level that seeds the first project.

### 2. Project Generator
Generates a project from: chosen technology, current skill level, and history of completed projects.
Each generated project includes:
- **Goal** — one-sentence description of what to build.
- **Requirements** — a concrete, checkable list (e.g. "increment button", "decrement button", "reset button").
- **Expected outcome** — what "done" looks like.
- **Optional hints** — pre-authored/generated, revealed only on request.
- Sized to be completable in ~15–30 minutes.

### 3. Code Submission & Review
- Learner submits by **pasting** code or **uploading** file(s).
- AI review is **concise** and covers: correctness, bugs, readability, React best practices, simplification opportunities.
- Review **explains** issues (with the *why*); it does **not** auto-rewrite unless the learner explicitly asks.
- Review concludes with a clear verdict: **complete** (unlock next) or **needs work** (with prioritized fixes).

Example feedback tone:
> "Your state updates correctly, but you're mutating the array directly. Create a new array instead — React relies on reference changes to detect updates. Here's why that matters…"

### 4. Hint System (progressive)
On-demand, escalating disclosure so learners try before they're told:
- **Hint 1** — small nudge.
- **Hint 2** — more specific guidance.
- **Hint 3** — nearly complete explanation.
- **Show solution** — final, explicit escape hatch.
Hints are revealed one level at a time; the next level requires an explicit action.

### 5. Coding Challenges (focused exercises)
Occasionally, instead of a full project, the AI inserts a small targeted exercise to reinforce a concept — e.g. "Build a custom React Hook" or "Refactor this component." Same submit → review loop, smaller surface. *(Include if it fits the build budget; otherwise fast-follow — see Phasing.)*

### 6. Progressive Difficulty & Progress Tracking
- Progression is gated by **demonstrated completion**, not fixed chapters.
- A struggling learner gets another same-level project before advancing.
- Progress (current track, level, completed projects, active project + submissions) persists per learner.

---

## AI Behavior Requirements

The mentor persona is the product. Requirements:
- **Explain, don't fix.** No unsolicited rewrites. Teach the reasoning behind each correction.
- **Encouraging and specific.** Acknowledge what worked before what didn't; avoid generic praise.
- **Concise.** Reviews and hints are short and actionable, not essays.
- **Consistent difficulty calibration.** New projects introduce only 1–2 new concepts while reinforcing prior ones.
- **Deterministic completion criteria.** A submission is judged against the project's explicit requirements list, so "complete" is defensible and repeatable.
- **Graceful with messy input.** Handles partial code, syntax errors, and non-code pastes without breaking the flow.

---

## Screens (MVP)

1. **Onboarding / Skill Select** — choose technology + answer calibration questions.
2. **Active Project** — the primary screen: goal, requirements checklist, expected outcome, hint controls, and a submit (paste/upload) area.
3. **Review Result** — inline feedback, per-requirement status, verdict, and either "Improve & resubmit" or "Unlock next project."
4. **Track / Progress** — list of completed and upcoming projects; entry point back into the active project.

*(Keep it to one focused flow. No dashboards, settings sprawl, or content library in MVP.)*

---

## Success Metrics

- **Activation:** % of new users who complete Project 1.
- **Core-loop retention:** % who complete ≥3 projects.
- **Progression:** median projects completed per active learner.
- **Review quality (proxy):** resubmission rate and hint-usage distribution; qualitative thumbs up/down on reviews.
- **Independence:** % of projects completed without reaching "Show solution."

---

## Key Assumptions & Open Questions

- Learners code in their own editor and paste/upload back. *(Assumption — validated by scope choice; revisit if drop-off at submission is high.)*
- Requires user accounts to persist progress. *(Assumption for MVP — needed for "leave and return.")*
- **Decision:** Google OAuth is the production sign-in method. Local development may use an isolated credentials provider for testing.
- **Open:** How submissions are stored/retained and any privacy handling for pasted code.
- **Open:** LLM provider/model and prompt strategy for review + generation (default to a latest, capable model; finalize in tech design).

---

## Phasing

- **MVP (this doc):** Core loop, React only, hint system, progress persistence, project generator, code review.
- **Fast-follow:** Focused coding challenges (Feature 5) if not in MVP; additional technologies; in-app editor; live code execution.
- **Later:** Monetization (freemium), analytics dashboards, multi-track learning, community.
