export type EventBusActiveHandler = {
  readonly eventName: string;
  readonly handlerName: string;
  /** Unix timestamp in milliseconds captured when the handler started. */
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
    };
