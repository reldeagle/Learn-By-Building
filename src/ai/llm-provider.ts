import { z } from "zod";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type CompletionRequest<T> = {
  system: string;
  messages: Message[];
  schema?: z.ZodType<T>;
  maxTokens: number;
  temperature?: number;
  timeoutMs?: number;
};

export class AIServiceError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

export interface LLMProvider {
  complete<T>(request: CompletionRequest<T>): Promise<T>;
  stream(request: CompletionRequest<string>): AsyncIterable<string>;
}
