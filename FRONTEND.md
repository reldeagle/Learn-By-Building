# Frontend — Learn By Building

What the app looks like. Design spec for Phase 6 (tasks 37–43).
[ARCHITECTURE.md](ARCHITECTURE.md) §9 owns routing and layering; this doc owns appearance, layout, and components.

---

## Principles

- **One screen, one job.** The learner is either building, reading feedback, or choosing what's next — never all three at once.
- **Calm, not gamified.** A mentor's tone is legible and unhurried. No XP, badges, streaks, or celebration animations (PRD non-goal).
- **Server state is the truth.** Pages render from the database. Client interactivity is limited to hints, the submission box, and the streaming review.
- **Plain Tailwind, no UI library.** The surface is small enough that a component library would cost more than it saves.

---

## Style

**Dark only.** No light theme — the app commits to one look.

| Role | Value |
|---|---|
| Page background | `slate-950` |
| Card surface | `slate-900` |
| Border | `slate-800` |
| Primary text | `slate-100` |
| Secondary text | `slate-400` |
| Accent (actions, eyebrow labels) | `cyan-300` text, `cyan-400/10` fill |

**Semantic color** — three states carry meaning and must be colored consistently:

| State | Color |
|---|---|
| Verdict `complete` | emerald |
| Verdict `needs_work` | amber |
| Requirement `met: true` / `false` | emerald / slate |
| Feedback `priority` high / medium / low | rose / amber / slate |

Color is never the only signal — pair it with an icon or label for accessibility.

**Type.** Geist Sans for everything; **Geist Mono for every code surface** — the submission box, and any code inside hints or feedback. Both are already loaded in `layout.tsx`.

**Shape & rhythm.** `rounded-2xl` cards, `rounded-xl` controls, generous padding, a single `max-w-3xl` centered column on every screen. Headings `font-semibold tracking-tight`; eyebrow labels uppercase at `tracking-[0.25em]`.

**globals.css needs three fixes** (it's still the create-next-app default):
1. Remove `body { font-family: Arial... }` — it currently overrides Geist.
2. Remove the `prefers-color-scheme` block and the `--background`/`--foreground` defaults.
3. Define the surface and semantic tokens above in `@theme`.

---

## Screens

### Onboarding / Skill Select — `(onboarding)/start`

Single centered card. A technology picker leads: React is selectable, and one or two other technologies appear visibly locked — this signals the track system will grow without implying it exists yet. Below it, the two calibration inputs from `StartTrackInputSchema`: a `jsExperience` textarea (1000-char cap, with a live counter) and a `level` choice of beginner / intermediate / experienced as three selectable cards rather than a dropdown. One primary button starts the track and routes to Project 1.

### Active Project — `project/[id]`

The primary screen, and the one that should feel best. Server component. Reading order top to bottom: eyebrow label with the project's position in the track, the `title`, the one-sentence `goal`, then `requirements` as a checklist — this is the contract the review grades against, so it gets visual weight. `expectedOutcome` follows as a short "done looks like" block. The hint control sits below the requirements, collapsed and quiet by default so the learner tries first. The submission box anchors the bottom.

### Review Result — `project/[id]/review`

The verdict banner leads — emerald for `complete`, amber for `needs_work` — so the outcome is known immediately. Then `requirementStatus`, each row showing the `requirement`, its met/unmet state, and the `reason`, so the verdict is always traceable to explicit criteria. Then `feedback`, ordered high → low `priority`, each item showing the `issue` with its `why` given equal weight — the *why* is the product, not a footnote. Feedback streams in token by token and reconciles to a validated `Review` when the stream closes. The screen ends in exactly one call to action: "Improve & resubmit" or "Unlock next project."

### Track / Progress — `track`

A single vertical list, ordered, showing each project as completed, active, or upcoming. Upcoming entries are deliberately vague — the next project doesn't exist until it's generated. The active project is the way back in and is the only emphasized row. No dashboard, no stats.

---

## Core components

| Component | Role | Type |
|---|---|---|
| `RequirementRow` | One requirement + met state + reason. Used on both Active Project and Review. | Server |
| `VerdictBanner` | `complete` / `needs_work` outcome banner. | Server |
| `FeedbackItem` | One issue + why + priority badge. | Server |
| `ProjectCard` | One row in the track list. | Server |
| `HintControl` | Progressive reveal — one level per click, then "Show solution". | Client |
| `CodeInput` | Paste textarea + file upload, with size limit. | Client |

Presentational only — no component fetches data or calls the AI. Pages pass data down.

---

## Data shape note

The Prisma `Project` and the Zod `ProjectSchema` differ, and pages sit on the seam:

- Prisma has `id`, `trackId`, `order`, `difficulty`, `status`, and `requirements` as `Requirement[]` rows (`{ text, lastMet }`). Zod has plain `requirements: string[]` plus `hints`.
- Prisma persists generated hint text in `Project.hints` JSON; `HintUnlock` records only which levels were revealed.
- `getCurrentLevel` returns `0` when nothing is unlocked, and hint levels are 1-indexed — so `HintControl` starts fully closed.

Server components read the Prisma shape and map at the page boundary.
