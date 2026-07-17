import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FakeProvider } from "./fake-provider";
import { GoogleAIStudioProvider } from "./google-ai-studio-provider";
import type { CompletionRequest } from "./llm-provider";
import { mentorSystemPrompt } from "./prompts/mentor-v1";
import { createLLMProvider } from "./provider";
import { ProjectSchema } from "../lib/schemas";

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
});

describe("mentorSystemPrompt", () => {
  it("preserves the mentor persona", () => {
    expect(mentorSystemPrompt).toContain("Explain, do not fix");
    expect(mentorSystemPrompt).toContain("encouraging, specific, and concise");
  });
});
