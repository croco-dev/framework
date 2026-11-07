export type EventBusActiveHandler = {
  readonly eventName: string;
  readonly handlerName: string;
  /** Unix timestamp in milliseconds captured when the handler started. */
  readonly startTime: number;
};

/** An admitted dead-letter batch, including storage operations outside handler execution slots. */
export type EventBusActiveReplay = {
  /** Identity local to the owning EventBus instance. */
  readonly replayId: string;
  readonly phase: "dequeue" | "replay" | "requeue";
  /** Unix timestamp in milliseconds captured before dequeue starts. */
  readonly startTime: number;
};

export type EventBusShutdownOptions = {
  /** Positive integer milliseconds. Defaults to 10,000. */
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};

export type EventBusShutdownResult =
  | {
      readonly status: "drained";
      readonly unfinishedHandlers: readonly [];
    }
  | {
      readonly status: "timed-out" | "cancelled";
      readonly unfinishedHandlers: readonly EventBusActiveHandler[];
      /** Present when the implementation tracks dead-letter replay batches. */
      readonly unfinishedReplays?: readonly EventBusActiveReplay[];
    };
