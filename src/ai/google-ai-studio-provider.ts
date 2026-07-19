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
const MAX_PROVIDER_ERROR_LENGTH = 500;
const DEFAULT_MODEL = "gemini-2.5-flash";
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

const GeminiErrorSchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
    })
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

function summarizeIssues(error: z.ZodError) {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.code}:${issue.path.join(".") || "root"}`)
    .join(",");
}

function repairInstructions(error: z.ZodError) {
  return error.issues
    .slice(0, 3)
    .map(
      (issue) =>
        `- ${issue.path.join(".") || "root"}: ${issue.message}`,
    )
    .join("\n");
}

type StructuredResponse<T> =
  | { data: T; success: true }
  | { repairInstructions: string; success: false };

export class GoogleAIStudioProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = DEFAULT_MODEL,
  ) {}

  async complete<T>(request: CompletionRequest<T>): Promise<T> {
    const startedAt = Date.now();
    let retries = 0;
    let outputCharacters = 0;
    let outcome: "success" | "error" = "error";

    try {
      const initial = await this.withRetry(() => this.generateContent(request));
      retries += initial.retries;
      outputCharacters += initial.value.length;
      const responseText = initial.value;

      if (!request.schema) {
        outcome = "success";
        return responseText as T;
      }

      const parsed = this.parseStructuredResponse(responseText, request.schema);

      if (parsed.success) {
        outcome = "success";
        return parsed.data;
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
                "Validation issues to correct:",
                parsed.repairInstructions,
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

      if (!repaired.success) {
        throw new AIServiceError(
          "Google AI Studio returned an invalid structured response.",
          false,
          undefined,
          "invalid_structured_output",
        );
      }

      outcome = "success";
      return repaired.data;
    } catch (error) {
      logEvent("ai.error", {
        provider: "google-ai-studio",
        operation: "complete",
        model: this.model,
        retryable: error instanceof AIServiceError ? error.retryable : false,
        status: error instanceof AIServiceError ? error.providerStatus ?? null : null,
        cause:
          error instanceof AIServiceError
            ? error.providerCause ?? "unknown"
            : "unexpected",
      });
      throw error;
    } finally {
      logEvent("ai.call", {
        provider: "google-ai-studio",
        operation: "complete",
        model: this.model,
        latencyMs: Date.now() - startedAt,
        retries,
        estimatedOutputTokens: Math.ceil(outputCharacters / 4),
        outcome,
      });
    }
  }

  async *stream(request: CompletionRequest<string>): AsyncIterable<string> {
    const startedAt = Date.now();
    let outputCharacters = 0;
    let retries = 0;
    let outcome: "success" | "error" = "error";
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      const streamResponse = await this.withRetry(() =>
        this.fetchResponse(this.streamUrl(), request, "text/event-stream"),
      );
      retries = streamResponse.retries;
      const response = streamResponse.value;

      if (!response.body) {
        throw new AIServiceError("Google AI Studio returned an empty stream.");
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
      outcome = "success";
    } catch (error) {
      logEvent("ai.error", {
        provider: "google-ai-studio",
        operation: "stream",
        model: this.model,
        retryable: error instanceof AIServiceError ? error.retryable : false,
        status: error instanceof AIServiceError ? error.providerStatus ?? null : null,
        cause:
          error instanceof AIServiceError
            ? error.providerCause ?? "unknown"
            : "unexpected",
      });
      throw error;
    } finally {
      if (reader) {
        await reader.cancel();
        reader.releaseLock();
      }
      logEvent("ai.call", {
        provider: "google-ai-studio",
        operation: "stream",
        model: this.model,
        latencyMs: Date.now() - startedAt,
        retries,
        estimatedOutputTokens: Math.ceil(outputCharacters / 4),
        outcome,
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
            thinkingConfig: { thinkingBudget: 0 },
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
        const providerCause = await this.readErrorCause(response);

        throw new AIServiceError(
          `Google AI Studio request failed (HTTP ${response.status}): ${providerCause}`,
          response.status === 429 || response.status >= 500,
          response.status,
          providerCause,
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
  ): StructuredResponse<T> {
    let json: unknown;

    try {
      json = JSON.parse(responseText);
    } catch {
      logEvent("ai.structured_output_invalid", {
        provider: "google-ai-studio",
        operation: "complete",
        cause: "invalid_json",
        issues: "invalid_json",
      });
      return {
        repairInstructions: "- root: The response was not valid JSON.",
        success: false,
      };
    }

    const result = schema.safeParse(json);

    if (!result.success) {
      logEvent("ai.structured_output_invalid", {
        provider: "google-ai-studio",
        operation: "complete",
        cause: "schema_validation",
        issues: summarizeIssues(result.error),
      });
      return {
        repairInstructions: repairInstructions(result.error),
        success: false,
      };
    }

    return { data: result.data, success: true };
  }

  private async readErrorCause(response: Response) {
    let body = "";

    try {
      body = await response.text();
    } catch {
      return "No error details received.";
    }

    if (!body) {
      return "No error details received.";
    }

    const parsed = GeminiErrorSchema.safeParse(
      (() => {
        try {
          return JSON.parse(body);
        } catch {
          return null;
        }
      })(),
    );
    const message = parsed.success ? parsed.data.error?.message : body;

    return (message ?? "No error details received.")
      .replaceAll(this.apiKey, "[redacted]")
      .replace(/\s+/g, " ")
      .slice(0, MAX_PROVIDER_ERROR_LENGTH);
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
