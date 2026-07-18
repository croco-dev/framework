import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { tool } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { InferToolInput, LanguageModel } from "ai";

describe("AI SDK dependency train", () => {
  it("accepts Zod 4 tool schemas and version 3 provider models", () => {
    const inputSchema = z.object({ prompt: z.string().min(1) });
    const echo = tool({
      inputSchema,
      execute: ({ prompt }) => prompt,
    });
    const input: InferToolInput<typeof echo> = { prompt: "hello" };
    const models = [
      createOpenAI({ apiKey: "test" })("gpt-5"),
      createAnthropic({ apiKey: "test" })("claude-sonnet-4-5"),
    ];
    const compatibleModels: LanguageModel[] = models;

    expect(inputSchema.parse(input)).toEqual(input);
    expect(echo.inputSchema).toBe(inputSchema);
    expect(compatibleModels).toHaveLength(2);
    expect(models.map((model) => model.specificationVersion)).toEqual(["v3", "v3"]);
  });
});
