import { restoreSerializedEventIdentity, type EventBus } from "@croco/events-core";
import { Token } from "@croco/framework-context";
import { Problem } from "@croco/problems-core";
import { Trace, recordEvent, withSpan } from "@croco/telemetry-api";
import { LlmGeneratedEvent } from "./events/LlmGeneratedEvent";
import { LlmStreamCompletedEvent } from "./events/LlmStreamCompletedEvent";
import type {
  LlmCompletion,
  LlmCompletionEventDeliveryClaim,
  LlmCompletionEvent,
  LlmCompletionEventIntent,
  LlmServiceOptions,
} from "./LlmCompletionEvents";
import type { LlmRegistry } from "./LlmRegistry";
import { LlmOperationAbortedProblem } from "./problems/LlmProblems";
import {
  LlmCompletionEventPublicationProblem,
  LlmServiceProblem,
} from "./problems/LlmServiceProblem";
import type { LlmCompletionEventDeliveryState } from "./problems/LlmServiceProblem";
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

type CompletionEventParams =
  | {
      operation: "generate";
      modelId: string;
      prompt: string;
      text: string;
      usage: LlmUsage;
      metadata?: GenerateResult["metadata"];
    }
  | {
      operation: "stream";
      modelId: string;
      text: string;
      usage: LlmUsage;
      chunkCount: number;
      textTruncated: boolean;
    };

export class LlmService {
  static readonly token = new Token<LlmService>("LlmService");

  constructor(
    private readonly registry: LlmRegistry,
    private readonly eventBus: EventBus,
    private readonly options: LlmServiceOptions = {},
  ) {}

  @Trace({ name: "llm.generate" })
  async generate(params: GenerateParams): Promise<GenerateResult> {
    try {
      assertNotAborted(params.signal, "generate");
      const modelId = params.modelId ?? "default";
      const model = await this.registry.getModel(modelId);
      const result = await model.generate(params);
      assertNotAborted(params.signal, "generate");

      // Provider completion remains recoverable if the separate event-delivery boundary fails.
      await this.publishCompletionEvent({
        operation: "generate",
        modelId: model.modelId,
        prompt: params.prompt,
        text: result.text,
        usage: result.usage,
        metadata: result.metadata,
      });

      return result;
    } catch (error) {
      throw normalizeOperationError(error, params.signal, "generate");
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
            text: completionText,
            usage,
            chunkCount,
            textTruncated: isCompletionTextTruncated,
          };
        } catch (error) {
          if (abortController.signal.aborted) {
            return;
          }

          throw normalizeOperationError(error, abortController.signal, "stream");
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

      removeAbortListener?.();
      assertNotAborted(params.signal, "stream");

      // Publish only after every chunk was delivered; a typed failure prevents replaying the stream.
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
      assertNotAborted(params.signal, "embed");
      const model = params.modelId ?? "default";
      const llmModel = await this.registry.getModel(model);
      const result = await llmModel.embed(params);
      assertNotAborted(params.signal, "embed");
      return result;
    } catch (error) {
      throw normalizeOperationError(error, params.signal, "embed");
    }
  }

  @Trace({ name: "llm.embed_many" })
  async embedMany(params: EmbedManyParams): Promise<EmbedManyResult> {
    try {
      assertNotAborted(params.signal, "embedMany");
      const model = params.modelId ?? "default";
      const llmModel = await this.registry.getModel(model);
      const result = await llmModel.embedMany(params);
      assertNotAborted(params.signal, "embedMany");
      return result;
    } catch (error) {
      throw normalizeOperationError(error, params.signal, "embedMany");
    }
  }

  async generateObject<T>(params: GenerateObjectParams<T>): Promise<T> {
    return withSpan(
      async (span) => {
        try {
          assertNotAborted(params.signal, "generateObject");
          const modelId = params.modelId ?? "default";
          span.setAttribute("llm.model_id", modelId);
          const model = await this.registry.getModel(modelId);
          const result = await model.generateObject(params);
          assertNotAborted(params.signal, "generateObject");
          return result;
        } catch (error) {
          throw normalizeOperationError(error, params.signal, "generateObject");
        }
      },
      { name: "llm.generate_object" },
    );
  }

  @Trace({ name: "llm.call_tool" })
  async callTool(params: ToolCallParams): Promise<ToolCallResult> {
    try {
      assertNotAborted(params.signal, "callTool");
      const modelId = params.modelId ?? "default";
      const model = await this.registry.getModel(modelId);
      const result = await model.callTool(params);
      assertNotAborted(params.signal, "callTool");
      return result;
    } catch (error) {
      throw normalizeOperationError(error, params.signal, "callTool");
    }
  }

  async retryCompletionEvent(
    recovery: LlmCompletionEventIntent | LlmCompletionEventPublicationProblem,
  ): Promise<void> {
    const intent =
      recovery instanceof LlmCompletionEventPublicationProblem ? recovery.intent : recovery;
    const completion =
      recovery instanceof LlmCompletionEventPublicationProblem
        ? recovery.completion
        : completionFromIntent(intent);

    await withSpan(
      async (span) => {
        span.setAttribute("llm.completion_event.id", intent.eventId);
        span.setAttribute("llm.completion_event.intent_id", intent.id);
        span.setAttribute("llm.completion_event.retry.started", true);

        try {
          if (
            recovery instanceof LlmCompletionEventPublicationProblem &&
            recovery.deliveryState === "published_unconfirmed"
          ) {
            span.setAttribute("llm.completion_event.delivery_state", recovery.deliveryState);
            await this.confirmPublishedCompletionEvent(
              completion,
              intent,
              recovery.durableIntentRecorded,
            );
            return;
          }

          const intentStore = this.options.completionEventIntentStore;
          if (intentStore) {
            let deliveryState: LlmCompletionEventDeliveryState;
            try {
              deliveryState = await intentStore.loadDeliveryState(intent.id);
              span.setAttribute("llm.completion_event.delivery_state", deliveryState);
            } catch (error) {
              throw new LlmCompletionEventPublicationProblem(
                completion,
                intent,
                "not_published",
                recovery instanceof LlmCompletionEventPublicationProblem
                  ? recovery.durableIntentRecorded
                  : false,
                error,
                "load_delivery_state",
              );
            }

            if (deliveryState === "published_unconfirmed") {
              await this.confirmPublishedCompletionEvent(completion, intent, true);
              return;
            }

            if (deliveryState === "delivery_in_progress") {
              return;
            }
          }

          await this.deliverCompletionEvent(intent, completion);
        } catch (error) {
          if (error instanceof LlmCompletionEventPublicationProblem) {
            span.setAttribute("llm.completion_event.delivery_state", error.deliveryState);
            span.setAttribute("llm.completion_event.failure_stage", error.failureStage);
          }
          throw error;
        }
      },
      { name: "llm.retry_completion_event" },
    );
  }

  private async publishCompletionEvent(params: CompletionEventParams): Promise<void> {
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

    const intent = completionEventIntent(params, event);
    await this.deliverCompletionEvent(intent, completionFromIntent(intent), event);
  }

  private async deliverCompletionEvent(
    intent: LlmCompletionEventIntent,
    completion: LlmCompletion,
    existingEvent?: LlmCompletionEvent,
  ): Promise<void> {
    const intentStore = this.options.completionEventIntentStore;
    let durableIntentRecorded = false;
    let deliveryState: LlmCompletionEventDeliveryState = "not_published";
    let deliveryClaim: LlmCompletionEventDeliveryClaim | undefined;
    let failureStage:
      | "record_pending"
      | "claim_delivery"
      | "publish"
      | "release_delivery"
      | "mark_published" = "record_pending";

    try {
      if (intentStore) {
        await intentStore.recordPending(intent);
        durableIntentRecorded = true;

        failureStage = "claim_delivery";
        deliveryClaim = await intentStore.claimDelivery(intent.id);
        if (!deliveryClaim) {
          recordEvent("llm.completion_event.delivery_claim_rejected", {
            "llm.completion_event.intent_id": intent.id,
            "llm.completion_event.delivery_claim_accepted": false,
          });
          return;
        }
        deliveryState = "delivery_in_progress";
      }

      failureStage = "publish";
      try {
        await this.eventBus.publish(existingEvent ?? completionEventFromIntent(intent));
      } catch (error) {
        deliveryState = "not_published";
        if (intentStore && deliveryClaim) {
          try {
            await intentStore.releaseDelivery(deliveryClaim);
          } catch (releaseError) {
            failureStage = "release_delivery";
            throw new LlmCompletionEventPublicationProblem(
              completion,
              intent,
              deliveryState,
              durableIntentRecorded,
              new Error(
                `Completion event delivery claim release failed after '${String(error)}': ${String(releaseError)}`,
              ),
              "release_delivery",
            );
          }
        }
        throw error;
      }
      deliveryState = "published_unconfirmed";

      if (intentStore) {
        failureStage = "mark_published";
        await intentStore.markPublished(intent.id, deliveryClaim);
      }
    } catch (error) {
      if (error instanceof LlmCompletionEventPublicationProblem) {
        throw error;
      }
      throw new LlmCompletionEventPublicationProblem(
        completion,
        intent,
        deliveryState,
        durableIntentRecorded,
        error,
        failureStage,
      );
    }
  }

  private async confirmPublishedCompletionEvent(
    completion: LlmCompletion,
    intent: LlmCompletionEventIntent,
    durableIntentRecorded: boolean,
  ): Promise<void> {
    const intentStore = this.options.completionEventIntentStore;

    if (!intentStore) {
      throw new LlmCompletionEventPublicationProblem(
        completion,
        intent,
        "published_unconfirmed",
        durableIntentRecorded,
        "Completion event intent store is not configured",
        "mark_published",
      );
    }

    try {
      await intentStore.markPublished(intent.id);
    } catch (error) {
      throw new LlmCompletionEventPublicationProblem(
        completion,
        intent,
        "published_unconfirmed",
        durableIntentRecorded,
        error,
        "mark_published",
      );
    }
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

function assertNotAborted(signal: AbortSignal | undefined, operation: string): void {
  if (signal?.aborted) {
    throw new LlmOperationAbortedProblem(operation);
  }
}

function normalizeOperationError(
  error: unknown,
  signal: AbortSignal | undefined,
  operation: string,
): Problem | LlmOperationAbortedProblem | LlmCompletionEventPublicationProblem {
  if (error instanceof LlmCompletionEventPublicationProblem) {
    return error;
  }

  if (error instanceof LlmOperationAbortedProblem || signal?.aborted) {
    return error instanceof LlmOperationAbortedProblem
      ? error
      : new LlmOperationAbortedProblem(operation);
  }

  if (error instanceof Problem) {
    return error;
  }

  return LlmServiceProblem.fromError(error);
}

function completionEventIntent(
  params: CompletionEventParams,
  event: LlmCompletionEvent,
): LlmCompletionEventIntent {
  return params.operation === "stream"
    ? {
        id: event.eventId,
        eventId: event.eventId,
        eventName: "llm.stream_completed",
        operation: "stream",
        modelId: params.modelId,
        text: params.text,
        usage: params.usage,
        chunkCount: params.chunkCount,
        textTruncated: params.textTruncated,
        occurredAt: event.timestamp.toISOString(),
      }
    : {
        id: event.eventId,
        eventId: event.eventId,
        eventName: "llm.generated",
        operation: "generate",
        modelId: params.modelId,
        prompt: params.prompt,
        text: params.text,
        usage: params.usage,
        metadata: params.metadata,
        occurredAt: event.timestamp.toISOString(),
      };
}

function completionEventFromIntent(intent: LlmCompletionEventIntent): LlmCompletionEvent {
  const event =
    intent.operation === "stream"
      ? new LlmStreamCompletedEvent(
          intent.modelId,
          intent.text,
          intent.usage,
          intent.chunkCount,
          intent.textTruncated,
        )
      : new LlmGeneratedEvent(intent.modelId, intent.prompt, intent.text, intent.usage);

  restoreSerializedEventIdentity(event, intent.eventId, intent.occurredAt);
  return event;
}

function completionFromIntent(intent: LlmCompletionEventIntent): LlmCompletion {
  return intent.operation === "stream"
    ? {
        operation: "stream",
        text: intent.text,
        usage: intent.usage,
        chunkCount: intent.chunkCount,
        textTruncated: intent.textTruncated,
        chunksDelivered: true,
      }
    : {
        operation: "generate",
        result: {
          text: intent.text,
          usage: intent.usage,
          metadata: intent.metadata,
        },
      };
}
