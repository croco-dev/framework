import { Container, LOGGER_TOKEN } from "@croco/framework-context";
import type { LlmUsage } from "@croco/llm-core";
import { recordError } from "@croco/telemetry-api";

export type UsageWithModelInfo = {
  usage: LlmUsage;
  modelId: string;
  provider: string;
};

type StreamIterationFailure = { occurred: false } | { occurred: true; error: unknown };

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

function reportStreamMeteringFailure(
  meteringError: unknown,
  iterationFailure: StreamIterationFailure,
): void {
  recordError(meteringError);

  const message = "[LlmMetering] Failed to finalize stream usage recording";
  const context = {
    meteringError,
    ...(iterationFailure.occurred ? { iterationError: iterationFailure.error } : {}),
  };

  try {
    const logger = Container.getOptional(LOGGER_TOKEN);
    if (logger) {
      const reportingResult: unknown = logger.error(message, context);
      void Promise.resolve(reportingResult).catch((reportingError: unknown) => {
        reportStreamMeteringFailureToConsole(message, { ...context, reportingError });
      });
      return;
    }
  } catch (reportingError) {
    reportStreamMeteringFailureToConsole(message, { ...context, reportingError });
    return;
  }

  reportStreamMeteringFailureToConsole(message, context);
}

function reportStreamMeteringFailureToConsole(
  message: string,
  context: Record<string, unknown>,
): void {
  try {
    const reportingResult: unknown = console.error(message, context);
    void Promise.resolve(reportingResult).catch(() => undefined);
  } catch {
    return;
  }
}

async function finalizeStreamUsage(
  onComplete: (usageInfo: UsageWithModelInfo | null) => Promise<void>,
  usageInfo: UsageWithModelInfo | null,
  iterationFailure: StreamIterationFailure,
): Promise<void> {
  try {
    await onComplete(usageInfo);
  } catch (meteringError) {
    reportStreamMeteringFailure(meteringError, iterationFailure);

    if (!iterationFailure.occurred) {
      throw meteringError;
    }
  }
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
      let iterationFailure: StreamIterationFailure = { occurred: false };

      try {
        for await (const chunk of stream) {
          const extracted = extractUsageFromChunk(chunk);
          if (extracted) {
            usageInfo = extracted;
          }
          yield chunk;
        }
      } catch (error) {
        iterationFailure = { occurred: true, error };
        throw error;
      } finally {
        await finalizeStreamUsage(options.onComplete, usageInfo, iterationFailure);
      }
    },
  };
}
