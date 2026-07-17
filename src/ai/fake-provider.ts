import type { CompletionRequest, LLMProvider } from "./llm-provider";
import { logEvent } from "@/lib/logger";

const defaultResponse = {
  title: "Counter app",
  goal: "Build a counter with increment, decrement, and reset controls.",
  requirements: [
    "Add an increment button",
    "Add a decrement button",
    "Add a reset button",
  ],
  expectedOutcome: "The displayed count changes when each control is clicked.",
  hints: [
    {
      level: 1,
      text: "Store the count in component state.",
      isSolution: false,
    },
    {
      level: 2,
      text: "Use useState for the count and connect each control to an updater.",
      isSolution: true,
    },
  ],
};

export class FakeProvider implements LLMProvider {
  constructor(private readonly response: unknown = defaultResponse) {}

  async complete<T>(request: CompletionRequest<T>): Promise<T> {
    const startedAt = Date.now();

    try {
      if (request.schema) {
        return request.schema.parse(this.response);
      }

      return this.response as T;
    } finally {
      logEvent("ai.call", {
        provider: "fake",
        operation: "complete",
        latencyMs: Date.now() - startedAt,
        retries: 0,
        estimatedOutputTokens: 0,
      });
    }
  }

  async *stream(): AsyncIterable<string> {
    const startedAt = Date.now();
    const response =
      typeof this.response === "string"
        ? this.response
        : JSON.stringify(this.response);

    try {
      yield response;
    } finally {
      logEvent("ai.call", {
        provider: "fake",
        operation: "stream",
        latencyMs: Date.now() - startedAt,
        retries: 0,
        estimatedOutputTokens: Math.ceil(response.length / 4),
      });
    }
  }
}
