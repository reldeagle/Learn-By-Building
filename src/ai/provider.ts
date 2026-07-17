import "server-only";

import { getConfig } from "../lib/config";

import { FakeProvider } from "./fake-provider";
import { GoogleAIStudioProvider } from "./google-ai-studio-provider";
import type { LLMProvider } from "./llm-provider";

export function createLLMProvider(): LLMProvider {
  const config = getConfig();

  if (config.LLM_PROVIDER === "fake") {
    return new FakeProvider();
  }

  return new GoogleAIStudioProvider(config.GOOGLE_AI_STUDIO_API_KEY!);
}
