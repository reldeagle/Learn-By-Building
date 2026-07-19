import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FakeProvider } from "./fake-provider";
import { GoogleAIStudioProvider } from "./google-ai-studio-provider";
import type { CompletionRequest } from "./llm-provider";
import { mentorSystemPrompt } from "./prompts/mentor-v1";
import { createLLMProvider } from "./provider";
import { createReviewEvaluationSchema, ProjectSchema } from "../lib/schemas";
import { generateProject } from "../modules/project-generator";
import { reviewSubmission } from "../modules/code-review";

const project = {
  title: "Counter app",
  goal: "Build a counter with three controls.",
  requirements: ["Increment the count", "Reset the count"],
  expectedOutcome: "The count updates when a control is clicked.",
  hints: [
    { level: 1, text: "Start with useState.", isSolution: false },
    { level: 2, text: "Use useState for the count value.", isSolution: true },
  ],
};

const structuredRequest: CompletionRequest<typeof project> = {
  system: "You are a mentor.",
  messages: [{ role: "user", content: "Create a project." }],
  schema: ProjectSchema,
  maxTokens: 256,
  timeoutMs: 100,
};

function geminiResponse(text: string) {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    { status: 200 },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("FakeProvider", () => {
  it("returns a schema-validated fixed response", async () => {
    const provider = new FakeProvider(project);

    await expect(provider.complete(structuredRequest)).resolves.toEqual(
      project,
    );
  });

  it("supports the complete local learner loop without a live model", async () => {
    const provider = new FakeProvider();
    const generatedProject = await generateProject(
      {
        technology: "react",
        currentLevel: 1,
        completedProjects: [],
      },
      provider,
    );

    await expect(
      reviewSubmission(
        generatedProject,
        "export default function App() { return <button>Increment</button>; }",
        provider,
      ),
    ).resolves.toMatchObject({ verdict: "complete" });
  });
});

describe("GoogleAIStudioProvider.complete", () => {
  it("uses structured output and returns a validated response", async () => {
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, request?: RequestInit) => {
        void input;
        void request;

        return Promise.resolve(geminiResponse(JSON.stringify(project)));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new GoogleAIStudioProvider("test-key").complete(
      structuredRequest,
    );

    expect(result).toEqual(project);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request?.body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.maxOutputTokens).toBe(256);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(
      body.generationConfig.responseJsonSchema.properties.title,
    ).not.toHaveProperty("minLength");
  });

  it("repairs one invalid structured response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse('{"title":"Counter app"}'))
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(project)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new GoogleAIStudioProvider("test-key").complete(structuredRequest),
    ).resolves.toEqual(project);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("includes concrete schema issues in the structured-output repair request", async () => {
    const invalidReview = JSON.stringify({
      requirementStatus: [
        {
          requirementIndex: 0,
          met: true,
          reason: "Implemented.",
        },
      ],
      feedback: [],
    });
    const validReview = JSON.stringify({
      requirementStatus: [
        {
          requirementIndex: 0,
          met: true,
          reason: "Implemented.",
        },
        {
          requirementIndex: 1,
          met: true,
          reason: "Implemented.",
        },
      ],
      feedback: [],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(invalidReview))
      .mockResolvedValueOnce(geminiResponse(validReview));
    vi.stubGlobal("fetch", fetchMock);

    await new GoogleAIStudioProvider("test-key").complete({
      ...structuredRequest,
      schema: createReviewEvaluationSchema(2),
    });

    const [, repairRequest] = fetchMock.mock.calls[1];
    const repairBody = JSON.parse(repairRequest?.body as string);
    const repairPrompt = repairBody.contents.at(-1).parts[0].text;

    expect(repairPrompt).toContain(
      "Every project requirement must be evaluated exactly once.",
    );
  });

  it("retries a timed-out request once before failing", async () => {
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new GoogleAIStudioProvider("test-key").complete({
        ...structuredRequest,
        timeoutMs: 1,
      }),
    ).rejects.toThrow("timed out");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("logs the Gemini status and reason without exposing the API key", async () => {
    const providerReason = "API key not valid. Please pass a valid API key.";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { message: providerReason } }), {
            status: 401,
          }),
        ),
      ),
    );

    await expect(
      new GoogleAIStudioProvider("test-key").complete(structuredRequest),
    ).rejects.toThrow(`HTTP 401): ${providerReason}`);

    const errorLog = info.mock.calls
      .map(([message]) => JSON.parse(message as string))
      .find((event) => event.event === "ai.error");

    expect(errorLog).toMatchObject({
      event: "ai.error",
      status: 401,
      cause: providerReason,
    });
    expect(JSON.stringify(errorLog)).not.toContain("test-key");
  });

  it("logs a schema issue summary without logging the model response", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(geminiResponse('{"title":"Counter app"}'))),
    );

    await expect(
      new GoogleAIStudioProvider("test-key").complete(structuredRequest),
    ).rejects.toThrow("invalid structured response");

    const structuredOutputLog = info.mock.calls
      .map(([message]) => JSON.parse(message as string))
      .find((event) => event.event === "ai.structured_output_invalid");

    expect(structuredOutputLog).toMatchObject({
      event: "ai.structured_output_invalid",
      cause: "schema_validation",
    });
    expect(structuredOutputLog.issues).toContain("invalid_type:goal");
    expect(JSON.stringify(structuredOutputLog)).not.toContain("Counter app");
  });
});

describe("GoogleAIStudioProvider.stream", () => {
  it("yields SSE tokens in order", async () => {
    const streamBody = [
      `data: ${JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Hello" }] } }],
      })}\n\n`,
      `data: ${JSON.stringify({
        candidates: [{ content: { parts: [{ text: " mentor" }] } }],
      })}\n\n`,
    ].join("");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(streamBody, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        ),
      ),
    );

    const tokens: string[] = [];

    for await (const token of new GoogleAIStudioProvider("test-key").stream({
      system: "You are a mentor.",
      messages: [{ role: "user", content: "Say hello." }],
      maxTokens: 64,
    })) {
      tokens.push(token);
    }

    expect(tokens).toEqual(["Hello", " mentor"]);
  });
});

describe("createLLMProvider", () => {
  it("selects the configured provider", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@localhost:5432/app");
    vi.stubEnv("LLM_PROVIDER", "fake");
    expect(createLLMProvider()).toBeInstanceOf(FakeProvider);

    vi.stubEnv("LLM_PROVIDER", "google-ai-studio");
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "test-key");
    expect(createLLMProvider()).toBeInstanceOf(GoogleAIStudioProvider);
  });

  it("passes the configured model to Google AI Studio", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(
      () =>
      Promise.resolve(geminiResponse(JSON.stringify(project))),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@localhost:5432/app");
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "test-key");
    vi.stubEnv("LLM_MODEL", "gemini-2.5-flash-lite");
    vi.stubEnv("LLM_PROVIDER", "google-ai-studio");

    await createLLMProvider().complete(structuredRequest);

    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/gemini-2.5-flash-lite:generateContent",
    );
  });
});

describe("mentorSystemPrompt", () => {
  it("preserves the mentor persona", () => {
    expect(mentorSystemPrompt).toContain("Explain, do not fix");
    expect(mentorSystemPrompt).toContain("encouraging, specific, and concise");
  });
});
