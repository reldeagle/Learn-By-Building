import { z } from "zod";

import { logEvent } from "@/lib/logger";

import {
  AIServiceError,
  type CompletionRequest,
  type LLMProvider,
  type Message,
} from "./llm-provider";

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 100;
const supportedJsonSchemaKeys = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

const GeminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z
              .array(z.object({ text: z.string().optional() }))
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toGeminiJsonSchema(schema: z.ZodType<unknown>) {
  return removeUnsupportedJsonSchema(z.toJSONSchema(schema));
}

function removeUnsupportedJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUnsupportedJsonSchema);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      if (!supportedJsonSchemaKeys.has(key)) {
        return [];
      }

      if (
        (key === "properties" || key === "$defs") &&
        child &&
        typeof child === "object" &&
        !Array.isArray(child)
      ) {
        return [
          [
            key,
            Object.fromEntries(
              Object.entries(child).map(([name, nestedSchema]) => [
                name,
                removeUnsupportedJsonSchema(nestedSchema),
              ]),
            ),
          ],
        ];
      }

      return [[key, removeUnsupportedJsonSchema(child)]];
    }),
  );
}

function toGeminiContents(messages: Message[]) {
  return messages.map(({ role, content }) => ({
    role: role === "assistant" ? "model" : "user",
    parts: [{ text: content }],
  }));
}

function extractText(payload: unknown) {
  const parsed = GeminiResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AIServiceError("Google AI Studio returned an invalid response.");
  }

  return (
    parsed.data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("") ?? ""
  );
}

export class GoogleAIStudioProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = "gemini-2.5-flash",
  ) {}

  async complete<T>(request: CompletionRequest<T>): Promise<T> {
    const startedAt = Date.now();
    let retries = 0;
    let outputCharacters = 0;

    try {
      const initial = await this.withRetry(() => this.generateContent(request));
      retries += initial.retries;
      outputCharacters += initial.value.length;
      const responseText = initial.value;

      if (!request.schema) {
        return responseText as T;
      }

      const parsed = this.parseStructuredResponse(responseText, request.schema);

      if (parsed) {
        return parsed;
      }

      const repairedResponse = await this.withRetry(() =>
        this.generateContent({
          ...request,
          messages: [
            ...request.messages,
            {
              role: "user",
              content: [
                "Your previous response did not match the required JSON schema.",
                "Return only a corrected JSON response that satisfies the schema.",
                "Previous response:",
                responseText,
              ].join("\n"),
            },
          ],
        }),
      );
      retries += repairedResponse.retries;
      outputCharacters += repairedResponse.value.length;
      const repaired = this.parseStructuredResponse(
        repairedResponse.value,
        request.schema,
      );

      if (!repaired) {
        throw new AIServiceError(
          "Google AI Studio returned an invalid structured response.",
        );
      }

      return repaired;
    } finally {
      logEvent("ai.call", {
        provider: "google-ai-studio",
        operation: "complete",
        latencyMs: Date.now() - startedAt,
        retries,
        estimatedOutputTokens: Math.ceil(outputCharacters / 4),
      });
    }
  }

  async *stream(request: CompletionRequest<string>): AsyncIterable<string> {
    const startedAt = Date.now();
    let outputCharacters = 0;
    const streamResponse = await this.withRetry(() =>
      this.fetchResponse(this.streamUrl(), request, "text/event-stream"),
    );
    const response = streamResponse.value;

    if (!response.body) {
      throw new AIServiceError("Google AI Studio returned an empty stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await this.readStreamChunk(reader, request);

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const text = this.parseStreamEvent(event);

          if (text) {
            outputCharacters += text.length;
            yield text;
          }
        }
      }

      const text = this.parseStreamEvent(buffer);

      if (text) {
        outputCharacters += text.length;
        yield text;
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
      logEvent("ai.call", {
        provider: "google-ai-studio",
        operation: "stream",
        latencyMs: Date.now() - startedAt,
        retries: streamResponse.retries,
        estimatedOutputTokens: Math.ceil(outputCharacters / 4),
      });
    }
  }

  private async generateContent<T>(request: CompletionRequest<T>) {
    const response = await this.fetchResponse(this.generateUrl(), request);
    const text = extractText(await this.readJson(response));

    if (!text) {
      throw new AIServiceError("Google AI Studio returned an empty response.");
    }

    return text;
  }

  private async fetchResponse<T>(
    url: string,
    request: CompletionRequest<T>,
    accept = "application/json",
  ) {
    if (!Number.isInteger(request.maxTokens) || request.maxTokens < 1) {
      throw new AIServiceError("maxTokens must be a positive integer.");
    }

    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
      throw new AIServiceError("timeoutMs must be greater than zero.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: accept,
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: toGeminiContents(request.messages),
          generationConfig: {
            maxOutputTokens: request.maxTokens,
            ...(request.temperature === undefined
              ? {}
              : { temperature: request.temperature }),
            ...(request.schema
              ? {
                  responseMimeType: "application/json",
                  responseJsonSchema: toGeminiJsonSchema(request.schema),
                }
              : {}),
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AIServiceError(
          "Google AI Studio request failed.",
          response.status === 429 || response.status >= 500,
        );
      }

      return response;
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new AIServiceError("Google AI Studio request timed out.", true);
      }

      throw new AIServiceError("Google AI Studio request failed.", true);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readJson(response: Response) {
    try {
      return await response.json();
    } catch {
      throw new AIServiceError("Google AI Studio returned invalid JSON.");
    }
  }

  private parseStructuredResponse<T>(
    responseText: string,
    schema: z.ZodType<T>,
  ) {
    try {
      const result = schema.safeParse(JSON.parse(responseText));

      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  private parseStreamEvent(event: string) {
    const data = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");

    if (!data || data === "[DONE]") {
      return "";
    }

    try {
      return extractText(JSON.parse(data));
    } catch {
      throw new AIServiceError("Google AI Studio returned an invalid stream.");
    }
  }

  private readStreamChunk(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    request: CompletionRequest<string>,
  ) {
    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return new Promise<ReadableStreamReadResult<Uint8Array>>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new AIServiceError("Google AI Studio stream timed out."));
        }, timeoutMs);

        reader
          .read()
          .then(resolve, reject)
          .finally(() => clearTimeout(timeout));
      },
    );
  }

  private async withRetry<T>(operation: () => Promise<T>) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        return { value: await operation(), retries: attempt };
      } catch (error) {
        if (
          !(error instanceof AIServiceError) ||
          !error.retryable ||
          attempt === MAX_ATTEMPTS - 1
        ) {
          throw error;
        }

        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }

    throw new AIServiceError("Google AI Studio request failed.");
  }

  private generateUrl() {
    return `${API_URL}/${this.model}:generateContent`;
  }

  private streamUrl() {
    return `${API_URL}/${this.model}:streamGenerateContent?alt=sse`;
  }
}
