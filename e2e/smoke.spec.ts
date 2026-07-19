import { expect, test, type Page } from "@playwright/test";

const REVIEW_RESULT_TIMEOUT_MS = 15_000;

function requiredEnvironment(name: "SMOKE_BASE_URL" | "SMOKE_PASSWORD") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be set before running browser smoke tests.`);
  }

  return value;
}

if (process.env.SMOKE_FAKE_PROVIDER !== "true") {
  throw new Error(
    "Set SMOKE_FAKE_PROVIDER=true before running browser smoke tests.",
  );
}

const baseUrl = requiredEnvironment("SMOKE_BASE_URL");
const password = requiredEnvironment("SMOKE_PASSWORD");
const emailPrefix = process.env.SMOKE_EMAIL_PREFIX ?? "smoke";
const runId = process.env.SMOKE_RUN_ID ?? Date.now().toString(36);

function emailFor(name: string) {
  const host = new URL(baseUrl).hostname.replaceAll(".", "-");
  return `${emailPrefix}+${host}-${runId}-${name}@example.test`;
}

async function signIn(page: Page, email: string) {
  await page.goto(`/signin?callbackUrl=${encodeURIComponent("/start")}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in for development" }).click();
  await page.waitForURL("**/start");
}

async function startTrack(page: Page) {
  await page
    .getByLabel("What is your JavaScript experience?")
    .fill("I have built a small JavaScript app.");
  await page.getByRole("button", { name: "Start Project 1" }).click();
  await page.waitForURL("**/project/**");
  return page.url();
}

test("signs in and starts then resumes a track", async ({ page }) => {
  const email = emailFor("resume");
  await signIn(page, email);
  const projectUrl = await startTrack(page);

  await page.goto("/start");
  await expect(
    page.getByRole("heading", { name: "Start your React track" }),
  ).toBeVisible();
  const resumedUrl = await startTrack(page);

  expect(resumedUrl).toBe(projectUrl);
});

test("pastes a submission and receives a review", async ({ page }) => {
  await signIn(page, emailFor("paste"));
  await startTrack(page);
  await page.getByRole("button", { name: "Use starter" }).click();
  await page.getByRole("button", { name: "Request review" }).click();

  await expect(
    page.getByRole("heading", { name: "Project complete" }),
  ).toBeVisible({ timeout: REVIEW_RESULT_TIMEOUT_MS });
});

test("drops multiple source files and receives a review", async ({ page }) => {
  await signIn(page, emailFor("files"));
  await startTrack(page);
  await page.getByRole("button", { name: "Upload files" }).click();
  const dropTarget = page
    .locator("label")
    .filter({ hasText: "Drop source files" });

  await dropTarget.evaluate((element) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File(
        ["export default function App() { return <main />; }"],
        "App.tsx",
        {
          type: "text/plain",
        },
      ),
    );
    dataTransfer.items.add(
      new File(["main { color: cyan; }"], "app.css", { type: "text/plain" }),
    );
    element.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer }),
    );
  });

  await expect(page.getByText("App.tsx")).toBeVisible();
  await expect(page.getByText("app.css")).toBeVisible();
  await page.getByRole("button", { name: "Request review" }).click();
  await expect(
    page.getByRole("heading", { name: "Project complete" }),
  ).toBeVisible({ timeout: REVIEW_RESULT_TIMEOUT_MS });
});

test("preserves a draft when the mentor fails and retries successfully", async ({
  page,
}) => {
  await signIn(page, emailFor("retry"));
  const projectUrl = await startTrack(page);
  const projectId = projectUrl.split("/").at(-1)!;
  const code =
    "export default function App() { return <main>Retry me</main>; }";
  await page.getByLabel("React TypeScript (TSX) code").fill(code);
  let allowReview = false;

  await page.route("**/api/review", async (route) => {
    if (!allowReview) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Your mentor is unavailable right now. Please try again.",
          retryable: true,
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.getByRole("button", { name: "Request review" }).click();
  await expect(
    page.getByRole("heading", { name: "Review unavailable" }),
  ).toBeVisible();
  await expect(
    page.evaluate(
      (id) => localStorage.getItem(`learn-by-building:submission-draft:${id}`),
      projectId,
    ),
  ).resolves.toContain("Retry me");

  allowReview = true;
  await page.getByRole("button", { name: "Retry review" }).click();
  await expect(
    page.getByRole("heading", { name: "Project complete" }),
  ).toBeVisible({ timeout: REVIEW_RESULT_TIMEOUT_MS });
});

test("returns to the protected project after session expiry", async ({
  page,
  context,
}) => {
  await signIn(page, emailFor("session"));
  const projectUrl = await startTrack(page);

  await context.clearCookies();
  await page.goto(projectUrl);
  await page.waitForURL((url) => url.pathname === "/signin");
  await page.getByLabel("Email").fill(emailFor("session"));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in for development" }).click();
  await page.waitForURL(projectUrl);
});
