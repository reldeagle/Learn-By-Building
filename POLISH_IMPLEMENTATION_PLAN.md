> **Superseded by [ROADMAP.md](ROADMAP.md).** This was the previous polish round; its sections 0–8 are already implemented. Kept for history only.

Implementation plan
0. Establish a reliable baseline
Reproduce sign-in, track creation, file submission, and review using one clean test account and one account with an existing track.
Add safe server-side request IDs and structured logs for auth, generation, review, database, and provider failures. Never log API keys or submitted learner code.
Classify failures into safe user-facing categories: expired session, existing track, rate limited, database unavailable, mentor unavailable, invalid submission, and unexpected error.
Add a short internal troubleshooting checklist for local and Vercel environments.
1. Make authentication professional and predictable
Make Google OAuth the production sign-in method, with a branded “Continue with Google” action.
Restrict the shared-password credentials provider to local development/testing, or remove it from production entirely.
Clearly label development sign-in if retained; do not present it as Google sign-in.
Configure distinct Google OAuth callback URLs for local and Vercel deployments.
Keep this app’s Auth.js cookie names and NEXTAUTH_URL isolated from Kru AI so local sessions cannot redirect across projects.
Preserve the intended destination through sign-in: visiting /start, a project, or review should return the learner there after authentication.
Add a compact account menu with signed-in email and sign-out.
Replace generic sign-in failures with specific, safe messages and a retry action.
Rotate the demo password that was entered into chat and keep its replacement only in local/Vercel environment settings.
2. Fix “Start project” and make track creation resumable
Before generating anything, check whether the authenticated learner already has a React track.
If a track exists, immediately route to its active project or track dashboard; do not call Gemini or attempt another database insert.
Treat duplicate-track database conflicts as a safe fallback to “resume your existing track.”
Disable the start button while the request is pending to prevent double submissions.
Replace “Sign in and try again” with targeted messages:session expired → sign in again;
existing track → continue track;
mentor unavailable → retry later;
database issue → retry with a safe message;
rate limit → explain when to retry.

Add a signed-in state to onboarding so learners can see who will own the new track.
Add tests for first-time start, existing-track resume, double-click protection, provider failure, and database conflict recovery.
3. Make AI generation and review dependable
Validate all required runtime configuration before AI work starts: Gemini provider selection, API key, database connection, Auth.js secret, and production URL.
Add a controlled internal health check for database and AI configuration; do not expose provider details publicly.
Keep all learner-facing AI failures generic and helpful, while retaining detailed internal logs.
Change review requirement matching from repeated natural-language requirement strings to stable requirement identifiers, then render the original requirement text from the database.
Use exactly one Gemini structured-output call for each review.
Replace the current second “streamed feedback” AI call with local progress stages such as “Reading submission,” “Checking requirements,” and “Preparing mentor feedback.”
Keep the mentor persona intact: explain the issue and why it matters; never rewrite the learner’s code.
Persist a submission only when a review can be completed, or explicitly model a failed review attempt. Do not silently accumulate unusable submissions.
Ensure one active project can transition to completed only once, even if review requests race.
Preserve a learner’s submission and let them retry when Gemini temporarily fails.
Add tests for malformed model output, timeout, one-call-per-review behavior, concurrent retries, partial requirement matches, and safe error responses.
4. Replace the fragile submission box with a proper workspace
Keep the product React-only for this release. The selected technology is React; JavaScript and TypeScript are implementation formats, not separate learning tracks.
Create one submission workspace with three clear modes:Paste code
Upload files
Write in app

Add drag-and-drop plus file picker support.
Support multiple text source files needed for a small React project, with an explicit supported-extension list.
Show selected files, paths, sizes, total size, remove controls, and clear validation feedback.
Reject binary, oversized, duplicate-path, unreadable, and unsupported files before review.
Make client and server submission-size limits consistent.
Combine selected files into a clearly delimited server-side review payload so the mentor can reason about file boundaries.
Store a local draft safely in the browser, restore it after navigation/reload, and provide a visible “discard draft” action.
Do not execute learner code, accept archives, or build a cloud runtime/sandbox.
5. Add the requested in-app coding experience
This is a deliberate PRD change: the current PRD says no in-app IDE. Keep the amendment narrow.
Add a lightweight React-focused code editor, not a full IDE.
Use a proven editor component only if its dependency cost is justified; otherwise start with an enhanced textarea and graduate only if syntax highlighting is required.
Default syntax mode based on the learner’s file type: JSX, TSX, JavaScript, or TypeScript.
Include line numbers, keyboard-friendly editing, tab indentation, copy/paste, and local draft restore.
Let learners switch between editor content and uploaded files without losing either.
Keep one primary editable file initially; do not introduce terminals, package installation, code execution, Git integration, or multi-language workspaces.
Update the PRD, architecture notes, and frontend guide to document this intentional scope extension.
6. Polish the learner experience
Add a consistent application shell: logo, track link, account menu, and a focused primary action per page.
Turn the home page into a useful signed-in landing state: start a track, continue active work, or view progress.
Improve onboarding with clear progress, estimated setup time, selected stack, and concise explanations of locked future technologies.
Give the track page a clear “current project,” completed work, and next-unlock state.
Improve the project page with stronger hierarchy: goal, requirements, hint progress, submission entry point, and progress context.
Keep review results focused: verdict, requirement-by-requirement evidence, mentor feedback, and one next action.
Use loading states, disabled button states, empty states, and recoverable error panels throughout.
Add route-level loading and error boundaries for onboarding, track, project, and review routes.
Improve responsive spacing and tap targets without adding dense dashboards or excessive decoration.
Add accessible focus management, keyboard navigation, form error announcements, reduced-motion support, and sufficient contrast.
Keep the existing dark minimal direction; add polish through hierarchy, consistency, and feedback—not visual clutter.
7. Production reliability and security
Replace the process-local rate-limit map with a shared serverless-compatible limiter before public launch.
Keep all limits enforced server-side: body size, file count, total text size, review frequency, generation frequency, and hint requests.
Ensure file contents are treated only as text and are never executed or exposed in logs.
Confirm Neon connection behavior under Vercel serverless concurrency and handle transient connection failures safely.
Ensure Auth.js production cookies are secure, app-specific, and correctly scoped.
Add production configuration validation with actionable deployment logs, not runtime surprises.
Add basic monitoring for failed sign-ins, failed generation, failed reviews, provider latency, and completion rate.
Keep submitted code out of analytics and error-reporting payloads.
8. Verification and release criteria
Extend unit tests with FakeProvider; never use Gemini in CI.
Add a narrow browser-level smoke suite covering:sign in → start/resume track;
paste submission → successful review;
drag/drop multi-file submission → successful review;
mentor failure → preserved draft and retry;
session expiry → sign-in return path.

Run typecheck, lint, tests, and production build after each implementation group.
Manually test desktop and mobile layouts, keyboard-only usage, slow network behavior, and Vercel preview deployments.
Update setup/deployment documentation for OAuth, Neon, Gemini, environment variables, and common failure recovery.
Release only when the learner can reliably sign in, resume/start a track, submit code through all three modes, receive a review, act on feedback, and continue progression.