import type { LlmUsage } from "@croco/llm-core";

export type UsageWithModelInfo = {
  usage: LlmUsage;
  modelId: string;
  provider: string;
};

export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    Symbol.asyncIterator in value &&
    typeof value[Symbol.asyncIterator as keyof typeof value] === "function"
  );
}

export function extractUsageFromChunk(chunk: unknown): UsageWithModelInfo | null {
  if (!chunk || typeof chunk !== "object") {
    return null;
  }

  if (!("usage" in chunk)) {
    return null;
  }

  const usageData = (chunk as { usage: unknown }).usage;
  if (!usageData || typeof usageData !== "object") {
    return null;
  }

  if (
    !("promptTokens" in usageData) ||
    !("completionTokens" in usageData) ||
    !("totalTokens" in usageData)
  ) {
    return null;
  }

  const usage = usageData as LlmUsage;
  const metadata = (chunk as { metadata?: { modelId?: string; provider?: string } }).metadata ?? {};

  return {
    usage,
    modelId: metadata.modelId ?? "unknown",
    provider: metadata.provider ?? "unknown",
  };
}

export function createMeteredAsyncIterable(
  stream: AsyncIterable<unknown>,
  options: {
    onComplete: (usageInfo: UsageWithModelInfo | null) => Promise<void>;
  },
): AsyncIterable<unknown> {
  return {
    [Symbol.asyncIterator]: async function* () {
      let usageInfo: UsageWithModelInfo | null = null;

      for await (const chunk of stream) {
        const extracted = extractUsageFromChunk(chunk);
        if (extracted) {
          usageInfo = extracted;
        }
        yield chunk;
      }

      await options.onComplete(usageInfo);
    },
  };
}
