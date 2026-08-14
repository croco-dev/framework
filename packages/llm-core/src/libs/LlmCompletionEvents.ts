import type { LlmGeneratedEvent } from "./events/LlmGeneratedEvent";
import type { LlmStreamCompletedEvent } from "./events/LlmStreamCompletedEvent";
import type { GenerateResult, LlmMetadata, LlmUsage } from "./types";

export type LlmCompletionEvent = LlmGeneratedEvent | LlmStreamCompletedEvent;

export type LlmGenerateCompletion = {
  readonly operation: "generate";
  readonly result: GenerateResult;
};

export type LlmStreamCompletion = {
  readonly operation: "stream";
  readonly text: string;
  readonly usage: LlmUsage;
  readonly chunkCount: number;
  readonly textTruncated: boolean;
  readonly chunksDelivered: true;
};

export type LlmCompletion = LlmGenerateCompletion | LlmStreamCompletion;
export type LlmCompletionEventDeliveryState =
  | "not_published"
  | "delivery_in_progress"
  | "published_unconfirmed";

export type LlmCompletionEventDeliveryClaim = {
  readonly intentId: string;
  readonly ownerId: string;
  readonly fencingToken: number;
};

/**
 * Stable completion-event data persisted for recovery. Generate intents retain the prompt unchanged,
 * so external stores must encrypt it as appropriate, define a retention period, and delete it after
 * delivery according to their data policy. Stream intents deliberately do not persist the prompt.
 */
export type LlmCompletionEventIntent =
  | {
      readonly id: string;
      readonly eventId: string;
      readonly eventName: "llm.generated";
      readonly operation: "generate";
      readonly modelId: string;
      readonly prompt: string;
      readonly text: string;
      readonly usage: LlmUsage;
      readonly metadata?: LlmMetadata;
      readonly occurredAt: string;
    }
  | {
      readonly id: string;
      readonly eventId: string;
      readonly eventName: "llm.stream_completed";
      readonly operation: "stream";
      readonly modelId: string;
      readonly text: string;
      readonly usage: LlmUsage;
      readonly chunkCount: number;
      readonly textTruncated: boolean;
      readonly occurredAt: string;
    };

/**
 * Optional durable boundary for completion events. Recording the same intent twice must be idempotent.
 * `claimDelivery` must atomically grant at most one active claim for an intent. Claims should expire so
 * abandoned delivery can be retried. `releaseDelivery` and a claimed `markPublished` transition must
 * validate the claim fencing token.
 */
export interface LlmCompletionEventIntentStore {
  recordPending(intent: LlmCompletionEventIntent): Promise<void>;
  loadDeliveryState(intentId: string): Promise<LlmCompletionEventDeliveryState>;
  claimDelivery(intentId: string): Promise<LlmCompletionEventDeliveryClaim | undefined>;
  releaseDelivery(claim: LlmCompletionEventDeliveryClaim): Promise<void>;
  markPublished(intentId: string, claim?: LlmCompletionEventDeliveryClaim): Promise<void>;
}

export type LlmServiceOptions = {
  readonly completionEventIntentStore?: LlmCompletionEventIntentStore;
};
