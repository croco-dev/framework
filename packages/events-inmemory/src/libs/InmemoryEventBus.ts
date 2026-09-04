import type {
  DeadLetterItem,
  DeadLetterPolicy,
  DeadLetterQueue,
  DomainEvent,
  EventBus,
  EventHandler,
  EventHandlerClass,
  EventSubscription,
  RetryableEventHandler,
} from "@croco/events-core";
import {
  DEFAULT_DEAD_LETTER_POLICY,
  EventBusConfig,
  EventSubscriptionIndex,
} from "@croco/events-core";
import type { ILogger, RuntimeInspector, RuntimeInspectorRecorder } from "@croco/framework-context";
import {
  Container,
  Context as CrocoContext,
  DEV_INSPECTOR_TOKEN,
  LOGGER_TOKEN,
  recordRuntimeInspectionEvent,
} from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { TraceInfo } from "@croco/telemetry-api";
import { getActiveTraceInfo, getTracer } from "@croco/telemetry-api";
import { type Context, context, type Span, SpanStatusCode, trace } from "@opentelemetry/api";
import {
  BackpressureExceededProblem,
  BackpressureTimeoutProblem,
  DeadLetterQueueNotConfiguredProblem,
  DeadLetterReplayHandlerUnavailableProblem,
  InvalidDeadLetterHandlerIdentityProblem,
  InvalidDeadLetterPolicyProblem,
  InvalidDeadLetterQueueLimitProblem,
  InvalidDeadLetterRetryCountProblem,
  InvalidEventBusConfigurationProblem,
  MAX_EVENT_BUS_CONCURRENCY,
  MAX_EVENT_BUS_TIMEOUT_MS,
} from "./problems/EventsInmemoryProblems";

export type EventPublishFailure = {
  handlerName: string;
  error: Error;
};

/** A dead-letter entry that could not be replayed successfully. */
export type DeadLetterReplayFailure = {
  /** Stable identity of the original event. */
  eventId: string;
  /** Registered event name used to resolve the failed handler. */
  eventName: string;
  /** Stable handler identity recorded when the entry was dead-lettered. */
  handlerId?: string;
  /** Replay or handler failure returned to the caller. */
  error: Error;
  /** Exact failed work, including updated retry metadata, for recovery. Contains event payload. */
  item: DeadLetterItem;
  /** Whether the failed item was successfully returned to storage. */
  requeued: boolean;
  /** Storage failure, separate from the original execution failure. */
  storageError?: Error;
};

/** Summary returned after a bounded dead-letter replay batch. */
export type DeadLetterReplayResult = {
  /** Number of entries atomically removed from the queue for this batch. */
  attempted: number;
  /** Number of entries consumed after successful handler execution. */
  succeeded: number;
  /** Number of unsuccessful entries; inspect each failure's requeued flag for storage state. */
  failed: number;
  /** Per-entry failures, including recoverable items when storage rejected a write. */
  failures: DeadLetterReplayFailure[];
};

/**
 * 하나 이상의 이벤트 핸들러 실행이 실패했을 때 집계 결과를 담아 반환하는 에러입니다.
 */
export class EventPublishFailedError extends Problem {
  readonly code = "events-inmemory/publish-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    readonly eventName: string,
    readonly failures: EventPublishFailure[],
  ) {
    const detail = `${failures.length} event handler(s) failed while publishing ${eventName}`;
    const cause = failures[0]?.error;
    super(undefined, undefined, detail, cause ? { cause } : undefined);
  }
}

/**
 * drop 전략이 일부 또는 전체 이벤트 핸들러 호출을 생략했을 때 발생하는 오류입니다.
 */
export class EventPublishDroppedProblem extends Problem {
  readonly code = "events-inmemory/publish-dropped";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    readonly eventName: string,
    readonly deliveredCount: number,
    readonly droppedCount: number,
    readonly failures: EventPublishFailure[],
  ) {
    super(
      undefined,
      undefined,
      `Dropped ${droppedCount} event subscriber(s) while publishing ${eventName} after delivering ${deliveredCount}`,
    );
  }
}

export type BackpressureStrategy = "drop" | "block" | "error";

export type InMemoryEventBusOptions = {
  /** Positive safe integer. Defaults to 100. */
  maxConcurrency?: number;
  backpressureStrategy?: BackpressureStrategy;
  /** Integer milliseconds from 1 through 2,147,483,647. Defaults to 5000. */
  backpressureTimeoutMs?: number;
  /** Enables handler retry exhaustion and replay through the configured storage adapter. */
  deadLetterQueue?: DeadLetterQueue;
  /** Bus-level retry defaults. Handler-level RetryableEventHandler values take precedence. */
  deadLetterPolicy?: Partial<DeadLetterPolicy>;
};

const DEFAULT_BACKPRESSURE_TIMEOUT_MS = 5000;

type RunningHandler = {
  eventName: string;
  handlerName: string;
  startTime: number;
};

type DeadLetterCapableHandler<TEvent extends DomainEvent> = EventHandler<TEvent> &
  Partial<RetryableEventHandler>;

type SubscriberExecution = {
  source: "publish" | "replay";
  priorRetryCount: number;
};

type SubscriberExecutionResult<TEvent extends DomainEvent> = {
  failure: EventPublishFailure | null;
  deadLetterItem?: DeadLetterItem<TEvent>;
  storageError?: Error;
};

/**
 * TypeDI와 OpenTelemetry를 사용하는 인메모리 EventBus 구현체입니다.
 */
export class InMemoryEventBus<
  TEvent extends DomainEvent = DomainEvent,
> implements EventBus<TEvent> {
  private readonly index = new EventSubscriptionIndex<EventHandlerClass<TEvent>>();
  private readonly tracer = getTracer();
  private readonly maxConcurrency: number;
  private readonly backpressureStrategy: BackpressureStrategy;
  private readonly backpressureTimeoutMs: number;
  private readonly deadLetterQueue?: DeadLetterQueue;
  private readonly deadLetterPolicy?: DeadLetterPolicy;
  private readonly deadLetterHandlers = new Map<string, EventHandlerClass<TEvent>>();
  private runningHandlers = new Map<string, RunningHandler>();
  private handlerCounter = 0;
  private readonly slotWaiters = new Set<() => void>();

  constructor(options: InMemoryEventBusOptions = {}) {
    const maxConcurrency = options.maxConcurrency === undefined ? 100 : options.maxConcurrency;
    if (
      !Number.isSafeInteger(maxConcurrency) ||
      maxConcurrency <= 0 ||
      maxConcurrency > MAX_EVENT_BUS_CONCURRENCY
    ) {
      throw new InvalidEventBusConfigurationProblem("maxConcurrency", maxConcurrency);
    }
    const backpressureTimeoutMs =
      options.backpressureTimeoutMs === undefined
        ? DEFAULT_BACKPRESSURE_TIMEOUT_MS
        : options.backpressureTimeoutMs;
    if (
      !Number.isSafeInteger(backpressureTimeoutMs) ||
      backpressureTimeoutMs <= 0 ||
      backpressureTimeoutMs > MAX_EVENT_BUS_TIMEOUT_MS
    ) {
      throw new InvalidEventBusConfigurationProblem("backpressureTimeoutMs", backpressureTimeoutMs);
    }
    this.maxConcurrency = maxConcurrency;
    this.backpressureStrategy = options.backpressureStrategy ?? "block";
    this.backpressureTimeoutMs = backpressureTimeoutMs;
    if (options.deadLetterPolicy && !options.deadLetterQueue) {
      throw new DeadLetterQueueNotConfiguredProblem();
    }
    this.deadLetterQueue = options.deadLetterQueue;
    this.deadLetterPolicy = options.deadLetterQueue
      ? this.resolveDeadLetterPolicy(options.deadLetterPolicy)
      : undefined;
  }

  async publish(event: TEvent): Promise<void> {
    const eventName = event.eventName;
    const traceInfo = getActiveTraceInfo();
    const baseEvent = this.createEventWithTraceContext(event, traceInfo);
    const handlerClasses = this.resolveSubscribers(eventName);
    const inspector = this.resolveRuntimeInspector();
    const startedAt = Date.now();

    this.recordInspectionEvent(inspector, {
      kind: "event.publish",
      outcome: "started",
      name: eventName,
      details: {
        subscriberCount: handlerClasses.length,
        eventTimestamp: event.timestamp,
        traceId: traceInfo.traceId,
      },
    });

    try {
      await this.tracer.startActiveSpan(
        `event.publish:${eventName}`,
        {
          attributes: this.createPublishSpanAttributes(event, traceInfo, handlerClasses.length),
        },
        async (publishSpan: Span) =>
          this.finishPublishSpan(publishSpan, handlerClasses, baseEvent, eventName),
      );
      this.recordInspectionEvent(inspector, {
        kind: "event.publish",
        outcome: "succeeded",
        name: eventName,
        durationMs: Date.now() - startedAt,
        details: {
          subscriberCount: handlerClasses.length,
        },
      });
    } catch (error) {
      const normalizedError = this.normalizeError(error);
      const details =
        normalizedError instanceof EventPublishDroppedProblem
          ? {
              subscriberCount: handlerClasses.length,
              deliveredCount: normalizedError.deliveredCount,
              droppedCount: normalizedError.droppedCount,
            }
          : {
              subscriberCount: handlerClasses.length,
              error: {
                name: normalizedError.name,
              },
            };
      this.recordInspectionEvent(inspector, {
        kind: "event.publish",
        outcome: "failed",
        name: eventName,
        durationMs: Date.now() - startedAt,
        details,
      });
      throw normalizedError;
    }
  }

  /**
   * Removes a batch and re-executes only its failed handlers.
   * Failed writes return the unpersisted item and storage error to the caller for recovery.
   */
  async replayDeadLetters(limit?: number): Promise<DeadLetterReplayResult> {
    if (!this.deadLetterQueue) {
      throw new DeadLetterQueueNotConfiguredProblem();
    }
    this.validateReplayLimit(limit);

    const items = await this.deadLetterQueue.dequeue<TEvent>(limit);
    const result: DeadLetterReplayResult = {
      attempted: items.length,
      succeeded: 0,
      failed: 0,
      failures: [],
    };

    for (const item of items) {
      this.recordReplayInspection("started", item);
      let execution: SubscriberExecutionResult<TEvent>;
      try {
        const handlerClass = this.resolveReplayHandler(item);
        if (!handlerClass) {
          throw new DeadLetterReplayHandlerUnavailableProblem(item.event.eventName, item.handlerId);
        }
        while (!this.hasAvailableSlot()) {
          if (this.backpressureStrategy !== "block") {
            throw new BackpressureExceededProblem(this.runningHandlers.size);
          }
          await this.waitForSlot();
        }
        execution = await this.executeSubscriberWithTracking(
          handlerClass,
          this.cloneEvent(item.event),
          item.event.eventName,
          { source: "replay", priorRetryCount: item.retryCount },
        );
      } catch (error) {
        execution = {
          failure: { handlerName: item.handlerId ?? "", error: this.normalizeError(error) },
        };
      }
      if (!execution.failure) {
        result.succeeded++;
        this.recordReplayInspection("succeeded", item);
        continue;
      }

      const failedItem = execution.deadLetterItem ?? item;
      let storageError = execution.storageError;
      if (!execution.deadLetterItem) {
        try {
          await this.deadLetterQueue.enqueue(failedItem);
        } catch (error) {
          storageError = this.normalizeError(error);
        }
      }
      result.failed++;
      result.failures.push({
        eventId: failedItem.event.eventId,
        eventName: failedItem.event.eventName,
        handlerId: failedItem.handlerId,
        error: execution.failure.error,
        item: failedItem,
        requeued: !storageError,
        storageError,
      });
      this.recordReplayInspection("failed", failedItem, storageError ?? execution.failure.error);
    }

    return result;
  }

  private async finishPublishSpan(
    publishSpan: Span,
    handlerClasses: EventHandlerClass<TEvent>[],
    baseEvent: TEvent,
    eventName: string,
  ): Promise<void> {
    try {
      await this.executeWithBackpressure(handlerClasses, baseEvent, eventName);
      publishSpan.setStatus({ code: SpanStatusCode.OK });
      EventBusConfig.getStats()?.publish(false);
    } catch (error) {
      const normalizedError = this.normalizeError(error);
      publishSpan.recordException(normalizedError);
      publishSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: normalizedError.message,
      });
      if (normalizedError instanceof EventPublishDroppedProblem) {
        publishSpan.setAttributes({
          "event.delivered_count": normalizedError.deliveredCount,
          "event.dropped_count": normalizedError.droppedCount,
        });
        EventBusConfig.getStats()?.drop();
      } else {
        EventBusConfig.getStats()?.publish(true);
      }
      throw normalizedError;
    } finally {
      publishSpan.end();
    }
  }

  private async executeWithBackpressure(
    handlerClasses: EventHandlerClass<TEvent>[],
    baseEvent: TEvent,
    eventName: string,
  ): Promise<void> {
    const failures: EventPublishFailure[] = [];
    let deliveredCount = 0;

    for (const [index, handlerClass] of handlerClasses.entries()) {
      while (!this.hasAvailableSlot()) {
        switch (this.backpressureStrategy) {
          case "drop": {
            throw new EventPublishDroppedProblem(
              eventName,
              deliveredCount,
              handlerClasses.length - index,
              failures,
            );
          }
          case "error": {
            throw new BackpressureExceededProblem(this.runningHandlers.size);
          }
          case "block": {
            await this.waitForSlot();
            break;
          }
        }
      }

      const { failure, storageError } = await this.executeSubscriberWithTracking(
        handlerClass,
        baseEvent,
        eventName,
        { source: "publish", priorRetryCount: 0 },
      );
      deliveredCount++;
      if (failure) {
        failures.push(
          storageError ? { handlerName: failure.handlerName, error: storageError } : failure,
        );
      }
    }

    if (failures.length > 0) {
      throw new EventPublishFailedError(eventName, failures);
    }
  }

  private hasAvailableSlot(): boolean {
    return this.runningHandlers.size < this.maxConcurrency;
  }

  private async waitForSlot(signal?: AbortSignal): Promise<void> {
    if (this.hasAvailableSlot()) {
      return;
    }

    if (signal?.aborted) {
      throw BackpressureTimeoutProblem.aborted();
    }

    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutMs = this.backpressureTimeoutMs;

      const cleanup = () => {
        this.slotWaiters.delete(onSlotAvailable);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        signal?.removeEventListener("abort", onAbort);
      };

      const onAbort = () => {
        cleanup();
        reject(BackpressureTimeoutProblem.aborted());
      };

      const onSlotAvailable = () => {
        if (!this.hasAvailableSlot()) {
          return;
        }

        cleanup();
        resolve();
      };

      this.slotWaiters.add(onSlotAvailable);

      timeoutId = setTimeout(() => {
        cleanup();
        reject(BackpressureTimeoutProblem.timeout(timeoutMs));
      }, timeoutMs);

      signal?.addEventListener("abort", onAbort, { once: true });
      onSlotAvailable();
    });
  }

  private notifySlotAvailable(): void {
    if (!this.hasAvailableSlot()) {
      return;
    }

    const nextWaiter = this.slotWaiters.values().next().value as (() => void) | undefined;
    if (nextWaiter) {
      nextWaiter();
    }
  }

  private async executeSubscriberWithTracking(
    handlerClass: EventHandlerClass<TEvent>,
    baseEvent: TEvent,
    eventName: string,
    execution: SubscriberExecution,
  ): Promise<SubscriberExecutionResult<TEvent>> {
    const handlerName = handlerClass.name;
    const handlerId = `${handlerName}-${++this.handlerCounter}`;
    const startTime = Date.now();
    const inspector = this.resolveRuntimeInspector();

    this.runningHandlers.set(handlerId, { eventName, handlerName, startTime });
    this.recordInspectionEvent(inspector, {
      kind: "event.handler",
      outcome: "started",
      name: handlerName,
      details: {
        eventName,
      },
    });

    try {
      const result = await this.executeSubscriber(handlerClass, baseEvent, eventName, execution);
      const { failure } = result;
      this.recordInspectionEvent(inspector, {
        kind: "event.handler",
        outcome: failure ? "failed" : "succeeded",
        name: handlerName,
        durationMs: Date.now() - startTime,
        details: {
          eventName,
          error: failure
            ? {
                name: failure.error.name,
              }
            : undefined,
        },
      });
      return result;
    } finally {
      this.runningHandlers.delete(handlerId);
      this.notifySlotAvailable();
    }
  }

  private createPublishSpanAttributes(
    event: TEvent,
    traceInfo: TraceInfo,
    subscriberCount: number,
  ): Record<string, boolean | number | string> {
    return {
      "event.name": event.eventName,
      "event.subscriber_count": subscriberCount,
      "event.timestamp": event.timestamp.toISOString(),
      "trace.id": traceInfo.traceId ?? "",
      "trace.span_id": traceInfo.spanId ?? "",
      "trace.is_valid": traceInfo.isValid ?? false,
    };
  }

  private resolveSubscribers(eventName: string): EventHandlerClass<TEvent>[] {
    return Array.from(this.index.match(eventName));
  }

  private resolveReplayHandler(
    item: DeadLetterItem<TEvent>,
  ): EventHandlerClass<TEvent> | undefined {
    if (!item.handlerId) {
      return undefined;
    }

    const matchingHandlers = this.resolveSubscribers(item.event.eventName).filter(
      (handlerClass) => handlerClass.name === item.handlerId,
    );
    return matchingHandlers.length === 1 ? matchingHandlers[0] : undefined;
  }

  private async executeSubscriber(
    handlerClass: EventHandlerClass<TEvent>,
    baseEvent: TEvent,
    eventName: string,
    execution: SubscriberExecution,
  ): Promise<SubscriberExecutionResult<TEvent>> {
    const handlerName = handlerClass.name;
    if (!this.deadLetterQueue || !this.deadLetterPolicy) {
      return {
        failure: await this.executeHandlerAttempt(handlerClass, handlerName, baseEvent, eventName),
      };
    }

    let handlerInstance: DeadLetterCapableHandler<TEvent>;
    try {
      handlerInstance = Container.get(handlerClass) as DeadLetterCapableHandler<TEvent>;
    } catch (error) {
      return {
        failure: { handlerName, error: this.normalizeError(error) },
      };
    }

    let retryPolicy: DeadLetterPolicy;
    try {
      retryPolicy = this.resolveDeadLetterPolicy(handlerInstance.getRetryPolicy?.());
      if (
        execution.source === "replay" &&
        (!Number.isSafeInteger(execution.priorRetryCount) ||
          execution.priorRetryCount < 0 ||
          retryPolicy.maxRetries >= Number.MAX_SAFE_INTEGER - execution.priorRetryCount)
      ) {
        throw new InvalidDeadLetterRetryCountProblem(
          execution.priorRetryCount,
          retryPolicy.maxRetries,
        );
      }
    } catch (error) {
      return {
        failure: { handlerName, error: this.normalizeError(error) },
      };
    }

    let lastFailure: EventPublishFailure | null = null;
    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      const failure = await this.executeHandlerAttempt(
        handlerInstance,
        handlerName,
        baseEvent,
        eventName,
      );
      if (!failure) {
        if (attempt > 0 || execution.source === "replay") {
          this.recordRetryInspection("retry.success", "succeeded", baseEvent, handlerName, {
            retryCount: this.calculateRetryCount(execution, attempt),
          });
        }
        return { failure: null };
      }

      lastFailure = failure;
      const retryCount = this.calculateRetryCount(execution, attempt);
      this.recordRetryInspection("retry.error", "failed", baseEvent, handlerName, {
        retryCount,
        errorName: failure.error.name,
      });

      if (attempt < retryPolicy.maxRetries) {
        const delayMs = this.calculateRetryDelayMs(attempt + 1, retryPolicy);
        this.recordRetryInspection("retry.wait", "started", baseEvent, handlerName, {
          retryCount: retryCount + 1,
          delayMs,
        });
        if (delayMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    if (!lastFailure) {
      return { failure: null };
    }

    const retryCount =
      execution.source === "replay"
        ? execution.priorRetryCount + retryPolicy.maxRetries + 1
        : retryPolicy.maxRetries;
    this.recordRetryInspection("retry.exhausted", "failed", baseEvent, handlerName, {
      retryCount,
      errorName: lastFailure.error.name,
    });

    let surfacedFailure = lastFailure;
    if (handlerInstance.onExhaustedRetries) {
      try {
        await handlerInstance.onExhaustedRetries(this.cloneEvent(baseEvent), lastFailure.error);
      } catch (error) {
        surfacedFailure = { handlerName, error: this.normalizeError(error) };
      }
    }

    const deadLetterItem: DeadLetterItem<TEvent> = {
      event: this.cloneEvent(baseEvent),
      reason: "handler-retries-exhausted",
      failedAt: new Date(),
      retryCount,
      lastError: lastFailure.error.name,
      handlerId: handlerName,
      metadata: {
        errorName: lastFailure.error.name,
        retentionDays: retryPolicy.retentionDays,
      },
    };

    try {
      await this.deadLetterQueue.enqueue(deadLetterItem);
      this.recordDeadLetterInspection("succeeded", deadLetterItem);
      return { failure: surfacedFailure, deadLetterItem };
    } catch (error) {
      const enqueueError = this.normalizeError(error);
      this.recordDeadLetterInspection("failed", deadLetterItem, enqueueError);
      return {
        failure: surfacedFailure,
        deadLetterItem,
        storageError: enqueueError,
      };
    }
  }

  private async executeHandlerAttempt(
    handler: EventHandler<TEvent> | EventHandlerClass<TEvent>,
    handlerName: string,
    baseEvent: TEvent,
    eventName: string,
  ): Promise<EventPublishFailure | null> {
    const parentContext = this.createParentContext(baseEvent.metadata.traceContext);
    let failure: EventPublishFailure | null = null;

    await context.with(parentContext, async () => {
      await this.tracer.startActiveSpan(
        `event.handle:${handlerName}`,
        {
          attributes: {
            "event.name": eventName,
            "handler.name": handlerName,
            "handler.type": "consumer",
          },
        },
        async (handleSpan: Span) => {
          try {
            const handlerInstance =
              typeof handler === "function" ? Container.get(handler) : handler;
            const handlerEvent = this.cloneEvent(baseEvent);
            await handlerInstance.handle(handlerEvent);
            handleSpan.setStatus({ code: SpanStatusCode.OK });
          } catch (error) {
            const normalizedError = this.normalizeError(error);
            failure = {
              handlerName,
              error: normalizedError,
            };
            handleSpan.recordException(normalizedError);
            handleSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: normalizedError.message,
            });

            try {
              const logger = Container.get(LOGGER_TOKEN) as ILogger;
              logger.error(`EventHandler error (${eventName}):`, normalizedError);
            } catch {
              // Fallback when DI container cannot resolve Logger.
              // This is intentional: error logging must not fail silently.
              // eslint-disable-next-line no-console
              console.error(`EventHandler error (${eventName}):`, normalizedError);
            }
          } finally {
            handleSpan.end();
          }
        },
      );
    });

    return failure;
  }

  private createEventWithTraceContext(event: TEvent, traceContext: TraceInfo): TEvent {
    const eventCopy = this.cloneEvent(event);
    const traceContextCopy = { ...traceContext };
    eventCopy.metadata = {
      ...eventCopy.metadata,
      traceContext: traceContextCopy,
    };

    return eventCopy;
  }

  private createParentContext(traceContext: TEvent["metadata"]["traceContext"]): Context {
    if (!traceContext?.isValid || !traceContext.traceId || !traceContext.spanId) {
      return context.active();
    }

    return trace.setSpanContext(context.active(), {
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      traceFlags: traceContext.traceFlags ?? 0,
      isRemote: true,
    });
  }

  private resolveDeadLetterPolicy(overrides?: Partial<DeadLetterPolicy>): DeadLetterPolicy {
    const basePolicy = this.deadLetterPolicy ?? DEFAULT_DEAD_LETTER_POLICY;
    const policy: DeadLetterPolicy = {
      maxRetries:
        overrides?.maxRetries !== undefined ? overrides.maxRetries : basePolicy.maxRetries,
      retryDelayMs:
        overrides?.retryDelayMs !== undefined ? overrides.retryDelayMs : basePolicy.retryDelayMs,
      backoffMultiplier:
        overrides?.backoffMultiplier !== undefined
          ? overrides.backoffMultiplier
          : basePolicy.backoffMultiplier,
      maxRetryDelayMs:
        overrides?.maxRetryDelayMs !== undefined
          ? overrides.maxRetryDelayMs
          : basePolicy.maxRetryDelayMs,
      retentionDays:
        overrides?.retentionDays !== undefined ? overrides.retentionDays : basePolicy.retentionDays,
    };

    if (!Number.isSafeInteger(policy.maxRetries) || policy.maxRetries < 0) {
      throw new InvalidDeadLetterPolicyProblem("maxRetries", policy.maxRetries);
    }
    if (
      !Number.isSafeInteger(policy.retryDelayMs) ||
      policy.retryDelayMs < 0 ||
      policy.retryDelayMs > MAX_EVENT_BUS_TIMEOUT_MS
    ) {
      throw new InvalidDeadLetterPolicyProblem("retryDelayMs", policy.retryDelayMs);
    }
    if (!Number.isFinite(policy.backoffMultiplier) || policy.backoffMultiplier <= 0) {
      throw new InvalidDeadLetterPolicyProblem("backoffMultiplier", policy.backoffMultiplier);
    }
    if (
      !Number.isSafeInteger(policy.maxRetryDelayMs) ||
      policy.maxRetryDelayMs < 0 ||
      policy.maxRetryDelayMs > MAX_EVENT_BUS_TIMEOUT_MS
    ) {
      throw new InvalidDeadLetterPolicyProblem("maxRetryDelayMs", policy.maxRetryDelayMs);
    }
    if (!Number.isSafeInteger(policy.retentionDays) || policy.retentionDays <= 0) {
      throw new InvalidDeadLetterPolicyProblem("retentionDays", policy.retentionDays);
    }

    return policy;
  }

  private calculateRetryDelayMs(retryNumber: number, policy: DeadLetterPolicy): number {
    if (policy.retryDelayMs === 0 || policy.maxRetryDelayMs === 0) {
      return 0;
    }

    const delay = policy.retryDelayMs * policy.backoffMultiplier ** (retryNumber - 1);
    return Number.isFinite(delay)
      ? Math.min(delay, policy.maxRetryDelayMs)
      : policy.maxRetryDelayMs;
  }

  private calculateRetryCount(execution: SubscriberExecution, attempt: number): number {
    return execution.source === "replay" ? execution.priorRetryCount + attempt + 1 : attempt;
  }

  private validateReplayLimit(limit: number | undefined): void {
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit <= 0)) {
      throw new InvalidDeadLetterQueueLimitProblem(limit);
    }
  }

  private recordRetryInspection(
    kind: "retry.error" | "retry.wait" | "retry.success" | "retry.exhausted",
    outcome: "started" | "succeeded" | "failed",
    event: TEvent,
    handlerId: string,
    details: Record<string, unknown>,
  ): void {
    this.recordInspectionEvent(this.resolveRuntimeInspector(), {
      kind,
      outcome,
      name: handlerId,
      details: {
        eventId: event.eventId,
        eventName: event.eventName,
        handlerId,
        ...details,
      },
    });
  }

  private recordDeadLetterInspection(
    outcome: "succeeded" | "failed",
    item: DeadLetterItem<TEvent>,
    error?: Error,
  ): void {
    this.recordInspectionEvent(this.resolveRuntimeInspector(), {
      kind: "event.dead-letter",
      outcome,
      name: item.handlerId,
      details: {
        eventId: item.event.eventId,
        eventName: item.event.eventName,
        handlerId: item.handlerId,
        retryCount: item.retryCount,
        errorName: error?.name ?? item.lastError,
      },
    });
  }

  private recordReplayInspection(
    outcome: "started" | "succeeded" | "failed",
    item: DeadLetterItem<TEvent>,
    error?: Error,
  ): void {
    this.recordInspectionEvent(this.resolveRuntimeInspector(), {
      kind: "event.dead-letter-replay",
      outcome,
      name: item.handlerId,
      details: {
        eventId: item.event.eventId,
        eventName: item.event.eventName,
        handlerId: item.handlerId,
        retryCount: item.retryCount,
        errorName: error?.name,
      },
    });
  }

  private cloneEvent(event: TEvent): TEvent {
    const clonedEvent = Object.create(Object.getPrototypeOf(event)) as TEvent;
    Object.assign(clonedEvent, this.cloneValue({ ...event }));

    return clonedEvent;
  }

  private cloneValue<T>(value: T): T {
    if (value instanceof Date) {
      return new Date(value.getTime()) as T;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.cloneValue(item)) as T;
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    const prototype = Object.getPrototypeOf(value);

    if (prototype !== Object.prototype && prototype !== null) {
      return value;
    }

    const clonedEntries = Object.entries(value).map(([key, entryValue]) => [
      key,
      this.cloneValue(entryValue),
    ]);

    return Object.fromEntries(clonedEntries) as T;
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }

  private resolveRuntimeInspector(): RuntimeInspectorRecorder | undefined {
    return (
      CrocoContext.get()?.runtimeInspector ??
      Container.getOptional<RuntimeInspector>(DEV_INSPECTOR_TOKEN)
    );
  }

  private recordInspectionEvent(
    inspector: RuntimeInspectorRecorder | undefined,
    input: Parameters<typeof recordRuntimeInspectionEvent>[1],
  ): void {
    recordRuntimeInspectionEvent(inspector, input);
  }

  subscribe(subscription: EventSubscription<TEvent>): void {
    if (this.deadLetterQueue) {
      const { handlerClass } = subscription;
      const existing = this.deadLetterHandlers.get(handlerClass.name);
      if (!handlerClass.name || (existing && existing !== handlerClass)) {
        throw new InvalidDeadLetterHandlerIdentityProblem(handlerClass.name);
      }
      this.deadLetterHandlers.set(handlerClass.name, handlerClass);
    }
    this.index.add(subscription.eventName, subscription.handlerClass);
  }

  unsubscribe(subscription: EventSubscription<TEvent>): void {
    this.index.delete(subscription.eventName, subscription.handlerClass);
  }

  clear(): void {
    this.index.clear();
  }

  getRunningHandlerCount(): number {
    return this.runningHandlers.size;
  }

  getRunningHandlers(): ReadonlyArray<RunningHandler> {
    return Array.from(this.runningHandlers.values());
  }
}
