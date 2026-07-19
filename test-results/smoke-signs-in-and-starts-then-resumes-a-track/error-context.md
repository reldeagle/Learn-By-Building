# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> signs in and starts then resumes a track
- Location: e2e\smoke.spec.ts:48:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/project/**" until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "Learn By Building" [ref=e5] [cursor=pointer]:
          - /url: /
          - generic [ref=e6]: LB
          - text: Learn By Building
        - navigation "Primary navigation" [ref=e7]:
          - link "Your track" [ref=e8] [cursor=pointer]:
            - /url: /track
          - button "Account" [ref=e10]
    - main [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]:
          - paragraph [ref=e14]: Setup · Step 1 of 2
          - paragraph [ref=e15]: About 2 minutes
        - heading "Start your React track" [level=1] [ref=e16]
        - paragraph [ref=e17]: A short calibration helps your mentor choose a first project that is challenging without being overwhelming.
        - generic [ref=e18]:
          - generic [ref=e19]: R
          - generic [ref=e20]: "Selected stack: React"
        - generic [ref=e22]:
          - paragraph [ref=e23]: You are signed in as smoke+localhost-phase14-real-final-1784424146-resume@example.test
          - group "Choose a technology" [ref=e24]:
            - generic [ref=e25]: Choose a technology
            - paragraph [ref=e26]: React is the focused starting track. More technologies unlock in a future release.
            - generic [ref=e27]:
              - button "React Available now" [pressed] [ref=e28]:
                - generic [ref=e29]: React
                - generic [ref=e30]: Available now
              - button "TypeScript Locked Available after the React track is established." [disabled] [ref=e31]:
                - generic [ref=e32]: TypeScript
                - generic [ref=e33]: Locked
                - generic [ref=e34]: Available after the React track is established.
              - button "Node.js Locked Available after the React track is established." [disabled] [ref=e35]:
                - generic [ref=e36]: Node.js
                - generic [ref=e37]: Locked
                - generic [ref=e38]: Available after the React track is established.
          - generic [ref=e39]:
            - text: What is your JavaScript experience?
            - textbox "What is your JavaScript experience? 36/1000" [ref=e40]:
              - /placeholder: "For example: I finished a tutorial and have built a small todo app."
              - text: I have built a small JavaScript app.
            - generic [ref=e41]: 36/1000
          - group "Where should we start?" [ref=e42]:
            - generic [ref=e43]: Where should we start?
            - generic [ref=e44]:
              - button "Beginner I am still getting comfortable with JavaScript." [pressed] [ref=e45]:
                - text: Beginner
                - generic [ref=e46]: I am still getting comfortable with JavaScript.
              - button "Intermediate I have built a few small JavaScript projects." [ref=e47]:
                - text: Intermediate
                - generic [ref=e48]: I have built a few small JavaScript projects.
              - button "Experienced I am ready for a more demanding React challenge." [ref=e49]:
                - text: Experienced
                - generic [ref=e50]: I am ready for a more demanding React challenge.
          - alert [ref=e51]: Your mentor is temporarily unavailable. Please try again shortly.
          - button "Start Project 1" [ref=e52]
  - button "Open Next.js Dev Tools" [ref=e58] [cursor=pointer]:
    - img [ref=e59]
  - alert [ref=e62]
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | const REVIEW_RESULT_TIMEOUT_MS = 15_000;
  4   | 
  5   | function requiredEnvironment(name: "SMOKE_BASE_URL" | "SMOKE_PASSWORD") {
  6   |   const value = process.env[name];
  7   | 
  8   |   if (!value) {
  9   |     throw new Error(`${name} must be set before running browser smoke tests.`);
  10  |   }
  11  | 
  12  |   return value;
  13  | }
  14  | 
  15  | if (process.env.SMOKE_FAKE_PROVIDER !== "true") {
  16  |   throw new Error(
  17  |     "Set SMOKE_FAKE_PROVIDER=true before running browser smoke tests.",
  18  |   );
  19  | }
  20  | 
  21  | const baseUrl = requiredEnvironment("SMOKE_BASE_URL");
  22  | const password = requiredEnvironment("SMOKE_PASSWORD");
  23  | const emailPrefix = process.env.SMOKE_EMAIL_PREFIX ?? "smoke";
  24  | const runId = process.env.SMOKE_RUN_ID ?? Date.now().toString(36);
  25  | 
  26  | function emailFor(name: string) {
  27  |   const host = new URL(baseUrl).hostname.replaceAll(".", "-");
  28  |   return `${emailPrefix}+${host}-${runId}-${name}@example.test`;
  29  | }
  30  | 
  31  | async function signIn(page: Page, email: string) {
  32  |   await page.goto(`/signin?callbackUrl=${encodeURIComponent("/start")}`);
  33  |   await page.getByLabel("Email").fill(email);
  34  |   await page.getByLabel("Password").fill(password);
  35  |   await page.getByRole("button", { name: "Sign in for development" }).click();
  36  |   await page.waitForURL("**/start");
  37  | }
  38  | 
  39  | async function startTrack(page: Page) {
  40  |   await page
  41  |     .getByLabel("What is your JavaScript experience?")
  42  |     .fill("I have built a small JavaScript app.");
  43  |   await page.getByRole("button", { name: "Start Project 1" }).click();
> 44  |   await page.waitForURL("**/project/**");
      |              ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  45  |   return page.url();
  46  | }
  47  | 
  48  | test("signs in and starts then resumes a track", async ({ page }) => {
  49  |   const email = emailFor("resume");
  50  |   await signIn(page, email);
  51  |   const projectUrl = await startTrack(page);
  52  | 
  53  |   await page.goto("/start");
  54  |   await expect(
  55  |     page.getByRole("heading", { name: "Start your React track" }),
  56  |   ).toBeVisible();
  57  |   const resumedUrl = await startTrack(page);
  58  | 
  59  |   expect(resumedUrl).toBe(projectUrl);
  60  | });
  61  | 
  62  | test("pastes a submission and receives a review", async ({ page }) => {
  63  |   await signIn(page, emailFor("paste"));
  64  |   await startTrack(page);
  65  |   await page.getByRole("button", { name: "Use starter" }).click();
  66  |   await page.getByRole("button", { name: "Request review" }).click();
  67  | 
  68  |   await expect(
  69  |     page.getByRole("heading", { name: "Project complete" }),
  70  |   ).toBeVisible({ timeout: REVIEW_RESULT_TIMEOUT_MS });
  71  | });
  72  | 
  73  | test("drops multiple source files and receives a review", async ({ page }) => {
  74  |   await signIn(page, emailFor("files"));
  75  |   await startTrack(page);
  76  |   await page.getByRole("button", { name: "Upload files" }).click();
  77  |   const dropTarget = page
  78  |     .locator("label")
  79  |     .filter({ hasText: "Drop source files" });
  80  | 
  81  |   await dropTarget.evaluate((element) => {
  82  |     const dataTransfer = new DataTransfer();
  83  |     dataTransfer.items.add(
  84  |       new File(
  85  |         ["export default function App() { return <main />; }"],
  86  |         "App.tsx",
  87  |         {
  88  |           type: "text/plain",
  89  |         },
  90  |       ),
  91  |     );
  92  |     dataTransfer.items.add(
  93  |       new File(["main { color: cyan; }"], "app.css", { type: "text/plain" }),
  94  |     );
  95  |     element.dispatchEvent(
  96  |       new DragEvent("drop", { bubbles: true, dataTransfer }),
  97  |     );
  98  |   });
  99  | 
  100 |   await expect(page.getByText("App.tsx")).toBeVisible();
  101 |   await expect(page.getByText("app.css")).toBeVisible();
  102 |   await page.getByRole("button", { name: "Request review" }).click();
  103 |   await expect(
  104 |     page.getByRole("heading", { name: "Project complete" }),
  105 |   ).toBeVisible({ timeout: REVIEW_RESULT_TIMEOUT_MS });
  106 | });
  107 | 
  108 | test("preserves a draft when the mentor fails and retries successfully", async ({
  109 |   page,
  110 | }) => {
  111 |   await signIn(page, emailFor("retry"));
  112 |   const projectUrl = await startTrack(page);
  113 |   const projectId = projectUrl.split("/").at(-1)!;
  114 |   const code =
  115 |     "export default function App() { return <main>Retry me</main>; }";
  116 |   await page.getByLabel("React TypeScript (TSX) code").fill(code);
  117 |   let allowReview = false;
  118 | 
  119 |   await page.route("**/api/review", async (route) => {
  120 |     if (!allowReview) {
  121 |       await route.fulfill({
  122 |         status: 503,
  123 |         contentType: "application/json",
  124 |         body: JSON.stringify({
  125 |           error: "Your mentor is unavailable right now. Please try again.",
  126 |           retryable: true,
  127 |         }),
  128 |       });
  129 |       return;
  130 |     }
  131 | 
  132 |     await route.continue();
  133 |   });
  134 | 
  135 |   await page.getByRole("button", { name: "Request review" }).click();
  136 |   await expect(
  137 |     page.getByRole("heading", { name: "Review unavailable" }),
  138 |   ).toBeVisible();
  139 |   await expect(
  140 |     page.evaluate(
  141 |       (id) => localStorage.getItem(`learn-by-building:submission-draft:${id}`),
  142 |       projectId,
  143 |     ),
  144 |   ).resolves.toContain("Retry me");
```