import type { EventBus } from "@croco/events-core";
import { Token } from "@croco/framework-context";
import { Trace, withSpan } from "@croco/telemetry-api";
import { LlmGeneratedEvent } from "./events/LlmGeneratedEvent";
import { LlmStreamCompletedEvent } from "./events/LlmStreamCompletedEvent";
import type { LlmRegistry } from "./LlmRegistry";
import { LlmServiceProblem } from "./problems/LlmServiceProblem";
import type {
  EmbedManyParams,
  EmbedManyResult,
  EmbedParams,
  EmbedResult,
  GenerateObjectParams,
  GenerateParams,
  GenerateResult,
  LlmUsage,
  StreamChunk,
  StreamParams,
  ToolCallParams,
  ToolCallResult,
} from "./types";

const MAX_STREAM_BUFFER_CHUNKS = 1000;
const MAX_STREAM_COMPLETION_EVENT_TEXT_CHARS = 100_000;

export class LlmService {
  static readonly token = new Token<LlmService>("LlmService");

  constructor(
    private readonly registry: LlmRegistry,
    private readonly eventBus: EventBus,
  ) {}

  @Trace({ name: "llm.generate" })
  async generate(params: GenerateParams): Promise<GenerateResult> {
    try {
      const modelId = params.modelId ?? "default";
      const model = await this.registry.getModel(modelId);
      const result = await model.generate(params);

      await this.publishCompletionEvent({
        operation: "generate",
        modelId: model.modelId,
        prompt: params.prompt,
        text: result.text,
        usage: result.usage,
      });

      return result;
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  async *stream(params: StreamParams): AsyncIterable<StreamChunk> {
    const modelId = params.modelId ?? "default";
    const queuedChunks: StreamChunk[] = [];
    let queuedError: unknown;
    let hasQueuedError = false;
    let isDone = false;
    let isCancelled = false;
    let resumeConsumer: (() => void) | undefined;
    let resumeProducer: (() => void) | undefined;
    const abortController = new AbortController();
    let completionEvent:
      | {
          operation: "stream";
          modelId: string;
          prompt: string;
          text: string;
          usage: LlmUsage;
          chunkCount: number;
          textTruncated: boolean;
        }
      | undefined;

    const notifyConsumer = (): void => {
      const consumer = resumeConsumer;
      resumeConsumer = undefined;
      consumer?.();
    };

    const waitForProducer = async (): Promise<void> => {
      if (queuedChunks.length > 0 || hasQueuedError || isDone) {
        return;
      }

      await new Promise<void>((resolve) => {
        resumeConsumer = resolve;
      });
    };

    const notifyProducer = (): void => {
      const producer = resumeProducer;
      resumeProducer = undefined;
      producer?.();
    };

    const waitForBufferSpace = async (): Promise<void> => {
      if (queuedChunks.length < MAX_STREAM_BUFFER_CHUNKS || abortController.signal.aborted) {
        return;
      }

      await new Promise<void>((resolve) => {
        resumeProducer = resolve;
      });
    };

    const cancelProducer = (): void => {
      isCancelled = true;
      if (!abortController.signal.aborted) {
        abortController.abort();
      }
      queuedChunks.length = 0;
      notifyConsumer();
      notifyProducer();
    };

    const removeAbortListener = params.signal
      ? (() => {
          const abort = (): void => cancelProducer();
          params.signal.addEventListener("abort", abort, { once: true });
          return () => params.signal?.removeEventListener("abort", abort);
        })()
      : undefined;

    if (params.signal?.aborted) {
      cancelProducer();
    }

    const producer = withSpan(
      async (span) => {
        try {
          span.setAttribute("llm.model_id", modelId);

          const model = await this.registry.getModel(modelId);
          const streamParams = { ...params, signal: abortController.signal };
          const chunkIterator = model.stream(streamParams)[Symbol.asyncIterator]();
          let completionText = "";
          let completionTextLength = 0;
          let isCompletionTextTruncated = false;
          const streamUsage: Partial<LlmUsage> = {};
          let chunkCount = 0;

          try {
            while (true) {
              await waitForBufferSpace();
              if (abortController.signal.aborted) {
                break;
              }

              const result = await chunkIterator.next();
              if (result.done) {
                break;
              }

              const chunk = result.value;
              chunkCount += 1;
              completionTextLength += chunk.delta.length;

              const remainingTextLength =
                MAX_STREAM_COMPLETION_EVENT_TEXT_CHARS - completionText.length;
              if (remainingTextLength > 0) {
                completionText += chunk.delta.slice(0, remainingTextLength);
              }

              if (chunk.delta.length > remainingTextLength) {
                isCompletionTextTruncated = true;
              }

              if (chunk.usage) {
                Object.assign(streamUsage, chunk.usage);
              }

              queuedChunks.push(chunk);
              notifyConsumer();
            }
          } finally {
            if (abortController.signal.aborted) {
              await chunkIterator.return?.();
            }
          }

          if (abortController.signal.aborted) {
            return;
          }

          const usage = this.buildStreamUsage(params.prompt, completionTextLength, streamUsage);

          completionEvent = {
            operation: "stream",
            modelId: model.modelId,
            prompt: params.prompt,
            text: completionText,
            usage,
            chunkCount,
            textTruncated: isCompletionTextTruncated,
          };
        } catch (error) {
          if (abortController.signal.aborted) {
            return;
          }

          throw LlmServiceProblem.fromError(error);
        } finally {
          isDone = true;
          notifyConsumer();
        }
      },
      { name: "llm.stream" },
    ).catch((error) => {
      queuedError = error;
      hasQueuedError = true;
      notifyConsumer();
    });

    try {
      while (true) {
        const chunk = queuedChunks.shift();

        if (chunk) {
          notifyProducer();
          yield chunk;
          continue;
        }

        if (hasQueuedError) {
          throw queuedError;
        }

        if (isDone) {
          break;
        }

        await waitForProducer();
      }

      if (completionEvent && !isCancelled) {
        await this.publishCompletionEvent(completionEvent);
      }
    } finally {
      cancelProducer();
      removeAbortListener?.();
      await producer;
    }

    if (hasQueuedError) {
      throw queuedError;
    }
  }

  @Trace({ name: "llm.embed" })
  async embed(params: EmbedParams): Promise<EmbedResult> {
    try {
      const model = params.modelId ?? "default";
      const llmModel = await this.registry.getModel(model);
      return await llmModel.embed(params);
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  @Trace({ name: "llm.embed_many" })
  async embedMany(params: EmbedManyParams): Promise<EmbedManyResult> {
    try {
      const model = params.modelId ?? "default";
      const llmModel = await this.registry.getModel(model);
      return await llmModel.embedMany(params);
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  async generateObject<T>(params: GenerateObjectParams<T>): Promise<T> {
    return withSpan(
      async (span) => {
        try {
          const modelId = params.modelId ?? "default";
          span.setAttribute("llm.model_id", modelId);
          const model = await this.registry.getModel(modelId);
          return await model.generateObject(params);
        } catch (error) {
          throw LlmServiceProblem.fromError(error);
        }
      },
      { name: "llm.generate_object" },
    );
  }

  @Trace({ name: "llm.call_tool" })
  async callTool(params: ToolCallParams): Promise<ToolCallResult> {
    try {
      const modelId = params.modelId ?? "default";
      const model = await this.registry.getModel(modelId);
      return await model.callTool(params);
    } catch (error) {
      throw LlmServiceProblem.fromError(error);
    }
  }

  private async publishCompletionEvent(params: {
    operation: "generate" | "stream";
    modelId: string;
    prompt: string;
    text: string;
    usage: LlmUsage;
    chunkCount?: number;
    textTruncated?: boolean;
  }): Promise<void> {
    const event =
      params.operation === "stream"
        ? new LlmStreamCompletedEvent(
            params.modelId,
            params.text,
            params.usage,
            params.chunkCount,
            params.textTruncated,
          )
        : new LlmGeneratedEvent(params.modelId, params.prompt, params.text, params.usage);

    await this.eventBus.publish(event);
  }

  private buildStreamUsage(
    prompt: string,
    completionTextLength: number,
    usage: Partial<LlmUsage>,
  ): LlmUsage {
    const promptTokens = usage.promptTokens ?? prompt.length;
    const completionTokens = usage.completionTokens ?? completionTextLength;
    const totalTokens = usage.totalTokens ?? promptTokens + completionTokens;

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      accuracy: usage.accuracy,
    };
  }
}
