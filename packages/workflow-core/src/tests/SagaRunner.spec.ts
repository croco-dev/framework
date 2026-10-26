import { Problem, ProblemCategory } from "@croco/problems-core";
import { trace } from "@opentelemetry/api";
import type { Span, Tracer } from "@opentelemetry/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SagaDefinitionProblem,
  SagaExecutionFailedProblem,
  SagaFinalizationProblem,
  InMemorySagaStore,
  SagaListPaginationProblem,
  SagaRunner,
  type SagaDefinition,
  type SagaStore,
  type SagaOutboxMessage,
} from "../index";

class ProviderProblem extends Problem {
  constructor(detail: string) {
    super("workflow-core/test-provider-problem", ProblemCategory.InternalServerError, detail);
  }
}

class RetryableProviderProblem extends Problem {
  readonly retryable = true;

  constructor(detail: string) {
    super(
      "workflow-core/test-retryable-provider-problem",
      ProblemCategory.InternalServerError,
      detail,
    );
  }
}

class ExtensionRetryableProviderProblem extends Problem {
  constructor(detail: string, retryable?: boolean) {
    super(
      "workflow-core/test-extension-retryable-provider-problem",
      ProblemCategory.InternalServerError,
      detail,
      retryable === undefined ? undefined : { extensions: { retryable } },
    );
  }
}

class DualShapeRetryableProviderProblem extends Problem {
  constructor(
    detail: string,
    readonly retryable: boolean,
    extensionRetryable: boolean,
  ) {
    super(
      "workflow-core/test-dual-shape-retryable-provider-problem",
      ProblemCategory.InternalServerError,
      detail,
      { extensions: { retryable: extensionRetryable } },
    );
  }
}

class CompensationProblem extends Problem {
  constructor(detail: string) {
    super("workflow-core/test-compensation-problem", ProblemCategory.InternalServerError, detail);
  }
}

function getOrderId(payload: unknown): string {
  if (typeof payload !== "object" || payload === null || !("orderId" in payload)) {
    throw new ProviderProblem("orderId is required");
  }

  return String(payload.orderId);
}

function createGate(): { promise: Promise<void>; release: () => void } {
  let release: () => void = () => {
    throw new ProviderProblem("gate was not initialized");
  };
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function createMockSpan(): Span {
  return {
    spanContext: () => ({
      traceId: "00000000000000000000000000000001",
      spanId: "0000000000000001",
      traceFlags: 1,
      isRemote: false,
    }),
    setAttribute: vi.fn(),
    setAttributes: vi.fn(),
    addEvent: vi.fn(),
    addLink: vi.fn(),
    addLinks: vi.fn(),
    setStatus: vi.fn(),
    updateName: vi.fn(),
    end: vi.fn(),
    isRecording: vi.fn(() => true),
    recordException: vi.fn(),
  } as unknown as Span;
}

function createMockTracer(spanNames: string[], span: Span): Tracer {
  return {
    startActiveSpan: async <T>(name: string, fn: (span: Span) => T | Promise<T>) => {
      spanNames.push(name);
      return fn(span);
    },
    startSpan: () => span,
  } as Tracer;
}

describe("Saga Problems", () => {
  it("omits absent primary and compensation failure codes", () => {
    const problem = new SagaExecutionFailedProblem(
      "billing",
      "execution-1",
      { message: "charge failed", retryable: false },
      {
        status: "failed",
        compensationFailures: [{ message: "refund failed", retryable: true }],
      },
    );

    expect(problem.extensions).not.toHaveProperty("originalFailureCode");
    expect(problem.extensions?.compensationFailures).toEqual([
      { message: "refund failed", retryable: true },
    ]);
    expect(() => JSON.stringify(problem)).not.toThrow();
  });

  it("omits an absent finalization failure code", () => {
    const problem = new SagaFinalizationProblem(
      "billing",
      "execution-1",
      { message: "store unavailable", retryable: true },
      { status: "completing" },
    );

    expect(problem.extensions).not.toHaveProperty("originalFailureCode");
    expect(() => JSON.stringify(problem)).not.toThrow();
  });
});

describe("SagaRunner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid pagination before querying a configured store", async () => {
    const delegate = new InMemorySagaStore();
    const list = vi.fn((options) => delegate.list(options));
    const store: SagaStore = {
      create: (params) => delegate.create(params),
      findById: (id) => delegate.findById(id),
      findByIdempotencyKey: (sagaName, key) => delegate.findByIdempotencyKey(sagaName, key),
      update: (id, data) => delegate.update(id, data),
      list,
    };
    const runner = new SagaRunner(store);

    await expect(runner.listExecutions({ limit: 0 })).rejects.toThrow(SagaListPaginationProblem);
    expect(list).not.toHaveBeenCalled();
  });

  it("compensates completed steps in reverse order and keeps saga state queryable", async () => {
    const events: string[] = [];
    const publishedMessages: string[] = [];
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "subscription-seat-change",
      idempotencyKey: ({ payload }) => `seat-change:${getOrderId(payload)}`,
      outbox: {
        publish: (message) => {
          publishedMessages.push(`${message.stepId}:${message.topic}:${message.idempotencyKey}`);
        },
      },
      steps: [
        {
          id: "reserve-payment",
          idempotencyKey: ({ stepInput }) => `payment:${getOrderId(stepInput)}`,
          run: (input, { enqueueOutbox }) => {
            events.push("reserve-payment");
            enqueueOutbox({
              id: "payment-reserved",
              topic: "billing.reserved",
              payload: { orderId: getOrderId(input) },
              idempotencyKey: `outbox:${getOrderId(input)}`,
            });
            return { paymentId: "pay_123", orderId: getOrderId(input) };
          },
          compensate: (input, { enqueueOutbox }) => {
            events.push(`refund-payment:${getOrderId(input)}`);
            enqueueOutbox({
              id: "payment-refunded",
              topic: "billing.refunded",
              payload: { orderId: getOrderId(input) },
              idempotencyKey: `refund:${getOrderId(input)}`,
            });
            return { refunded: getOrderId(input) };
          },
        },
        {
          id: "provision-seat",
          input: ({ previousResults }) => previousResults[0]?.result,
          run: (input) => {
            events.push("provision-seat");
            return { seatId: "seat_123", orderId: getOrderId(input) };
          },
          compensate: (input, { enqueueOutbox }) => {
            events.push(`remove-seat:${getOrderId(input)}`);
            enqueueOutbox({
              id: "seat-removed",
              topic: "seats.removed",
              payload: { orderId: getOrderId(input) },
              idempotencyKey: `remove-seat:${getOrderId(input)}`,
            });
            return { removed: getOrderId(input) };
          },
        },
        {
          id: "notify-customer",
          run: () => {
            throw new ProviderProblem("notification provider unavailable");
          },
        },
      ],
    };

    await expect(runner.execute(definition, { orderId: "ord_123" })).rejects.toThrow(
      SagaExecutionFailedProblem,
    );

    const [failedExecution] = await runner.listExecutions({ sagaName: definition.name });

    expect(publishedMessages).toEqual([
      "provision-seat:seats.removed:remove-seat:ord_123",
      "reserve-payment:billing.refunded:refund:ord_123",
    ]);
    expect(
      failedExecution.steps.flatMap((step) => step.outboxMessages).map((message) => message.status),
    ).toEqual(["pending", "published", "published"]);

    await runner.dispatchOutbox(definition, failedExecution.id);
    const execution = await runner.getExecution(failedExecution.id);
    const queried = await runner.getExecution(execution.id);

    expect(queried).toBe(execution);
    expect(execution.status).toBe("compensated");
    expect(execution.error).toEqual(
      expect.objectContaining({
        code: "workflow-core/test-provider-problem",
        message: "notification provider unavailable",
      }),
    );
    expect(execution.compensationFailures).toEqual([]);
    expect(events).toEqual([
      "reserve-payment",
      "provision-seat",
      "remove-seat:ord_123",
      "refund-payment:ord_123",
    ]);
    expect(publishedMessages).toEqual([
      "provision-seat:seats.removed:remove-seat:ord_123",
      "reserve-payment:billing.refunded:refund:ord_123",
    ]);
    expect(execution.steps).toEqual([
      expect.objectContaining({
        id: "reserve-payment",
        status: "compensated",
        attempts: 1,
        maxAttempts: 1,
        idempotencyKey: "payment:ord_123",
        outboxMessages: expect.arrayContaining([
          expect.objectContaining({
            topic: "billing.reserved",
            stepId: "reserve-payment",
            idempotencyKey: "outbox:ord_123",
            phase: "step",
            status: "pending",
          }),
          expect.objectContaining({
            topic: "billing.refunded",
            stepId: "reserve-payment",
            idempotencyKey: "refund:ord_123",
            phase: "compensation",
            status: "published",
          }),
        ]),
      }),
      expect.objectContaining({
        id: "provision-seat",
        status: "compensated",
        attempts: 1,
        result: { seatId: "seat_123", orderId: "ord_123" },
      }),
      expect.objectContaining({
        id: "notify-customer",
        status: "failed",
        attempts: 1,
        error: expect.objectContaining({
          message: "notification provider unavailable",
        }),
      }),
    ]);

    await expect(runner.execute(definition, { orderId: "ord_123" })).rejects.toThrow(
      SagaExecutionFailedProblem,
    );
    expect(events).toEqual([
      "reserve-payment",
      "provision-seat",
      "remove-seat:ord_123",
      "refund-payment:ord_123",
    ]);
    await expect(runner.listExecutions({ sagaName: definition.name })).resolves.toHaveLength(1);
  });

  it("persists completed outbox intent before dispatch and recovers an ambiguous publish", async () => {
    const store = new InMemorySagaStore();
    const deliveredEffects = new Set<string>();
    const publishAttempts: string[] = [];
    let failAfterDelivery = true;
    const definition: SagaDefinition = {
      name: "durable-outbox-boundary",
      idempotencyKey: () => "durable-outbox-boundary:ord_123",
      outbox: {
        publish: async (message, context) => {
          const persisted = await store.findById(context.executionId);
          const persistedMessage = persisted?.steps
            .find((step) => step.id === context.step.id)
            ?.outboxMessages.find((candidate) => candidate.deliveryId === message.deliveryId);

          expect(persisted?.steps.find((step) => step.id === context.step.id)?.status).toBe(
            "completed",
          );
          expect(persistedMessage).toEqual(
            expect.objectContaining({
              deliveryId: message.deliveryId,
              status: "pending",
            }),
          );

          publishAttempts.push(message.deliveryId);
          deliveredEffects.add(message.deliveryId);
          if (failAfterDelivery) {
            failAfterDelivery = false;
            throw new ProviderProblem("publisher acknowledgement was lost");
          }
        },
      },
      steps: [
        {
          id: "reserve-payment",
          run: (_input, { enqueueOutbox }) => {
            enqueueOutbox({
              id: "payment-reserved",
              topic: "billing.reserved",
              payload: { orderId: "ord_123" },
            });
            return { paymentId: "pay_123" };
          },
        },
      ],
    };
    const runner = new SagaRunner(store);

    await expect(runner.execute(definition, { orderId: "ord_123" })).rejects.toThrow(
      "publisher acknowledgement was lost",
    );
    const [persisted] = await runner.listExecutions({ sagaName: definition.name });

    expect(persisted).toEqual(
      expect.objectContaining({
        status: "completed",
        steps: [
          expect.objectContaining({
            status: "completed",
            outboxMessages: [
              expect.objectContaining({
                status: "pending",
              }),
            ],
          }),
        ],
      }),
    );
    expect(persisted.steps[0]?.outboxMessages[0]).not.toHaveProperty("publishedAt");

    const recovered = await runner.execute(definition, { orderId: "ord_123" });
    const deliveryIds = publishAttempts;

    expect(recovered.reused).toBe(true);
    expect(deliveryIds).toHaveLength(2);
    expect(new Set(deliveryIds)).toEqual(new Set([deliveryIds[0]]));
    expect(deliveredEffects.size).toBe(1);
    expect(recovered.execution.steps[0]?.outboxMessages[0]).toEqual(
      expect.objectContaining({
        deliveryId: deliveryIds[0],
        status: "published",
        publishedAt: expect.any(String),
      }),
    );
  });

  it("does not rerun or publish a completed step when intent persistence fails", async () => {
    const delegate = new InMemorySagaStore();
    let rejectCompletion = true;
    const store: SagaStore = {
      create: (params) => delegate.create(params),
      findById: (id) => delegate.findById(id),
      findByIdempotencyKey: (sagaName, key) => delegate.findByIdempotencyKey(sagaName, key),
      list: (options) => delegate.list(options),
      update: (id, data) => {
        if (rejectCompletion && data.steps?.some((step) => step.status === "completed")) {
          rejectCompletion = false;
          throw new Error("completed intent persistence failed");
        }
        return delegate.update(id, data);
      },
    };
    const publish = vi.fn();
    const effects: string[] = [];
    const definition: SagaDefinition = {
      name: "failed-outbox-persistence",
      outbox: { publish },
      steps: [
        {
          id: "reserve-payment",
          retry: { maxAttempts: 3 },
          run: (_input, { enqueueOutbox }) => {
            effects.push("reserve-payment");
            enqueueOutbox({
              id: "payment-reserved",
              topic: "billing.reserved",
              payload: { orderId: "ord_123" },
            });
            return { paymentId: "pay_123" };
          },
        },
      ],
    };
    const runner = new SagaRunner(store);

    await expect(runner.execute(definition, { orderId: "ord_123" })).rejects.toThrow(
      SagaExecutionFailedProblem,
    );
    const [execution] = await runner.listExecutions({ sagaName: definition.name });

    expect(publish).not.toHaveBeenCalled();
    expect(effects).toEqual(["reserve-payment"]);
    expect(execution.status).toBe("failed");
    expect(execution.steps[0]).toEqual(
      expect.objectContaining({
        status: "failed",
        outboxMessages: [],
      }),
    );
  });

  it("compensates a step whose run succeeded before its completion write failed", async () => {
    const delegate = new InMemorySagaStore();
    let rejectChargeCompletion = true;
    const store: SagaStore = {
      create: (params) => delegate.create(params),
      findById: (id) => delegate.findById(id),
      findByIdempotencyKey: (sagaName, key) => delegate.findByIdempotencyKey(sagaName, key),
      list: (options) => delegate.list(options),
      update: (id, data) => {
        if (
          rejectChargeCompletion &&
          data.steps?.some((step) => step.id === "charge-card" && step.status === "completed")
        ) {
          rejectChargeCompletion = false;
          throw new Error("step store write timed out");
        }
        return delegate.update(id, data);
      },
    };
    const effects: string[] = [];
    const publish = vi.fn();
    let refundCalls = 0;
    const definition: SagaDefinition = {
      name: "checkout-completion-write-failure",
      outbox: { publish },
      steps: [
        {
          id: "reserve-stock",
          run: () => {
            effects.push("reserve-stock");
            return { reservationId: "res_1" };
          },
          compensate: (_input, { previousResults }) => {
            expect(previousResults).toEqual([
              { stepId: "reserve-stock", result: { reservationId: "res_1" } },
              { stepId: "charge-card", result: { chargeId: "ch_1" } },
            ]);
            effects.push("release-stock");
          },
        },
        {
          id: "charge-card",
          run: (_input, { enqueueOutbox }) => {
            effects.push("charge-card");
            enqueueOutbox({
              id: "charged",
              topic: "billing.charged",
              payload: { chargeId: "ch_1" },
            });
            return { chargeId: "ch_1" };
          },
          compensate: (_input, context) => {
            refundCalls += 1;
            expect(context.stepInput).toEqual({ orderId: "ord_1" });
            expect(context.stepResult.result).toEqual({ chargeId: "ch_1" });
            expect(context.attempt).toBe(1);
            effects.push("refund-card");
          },
        },
      ],
    };
    const runner = new SagaRunner(store);

    const problem = await runner
      .execute(definition, { orderId: "ord_1" })
      .catch((error: unknown) => error);
    const [execution] = await runner.listExecutions({ sagaName: definition.name });

    expect(problem).toBeInstanceOf(SagaExecutionFailedProblem);
    expect(problem).toHaveProperty(
      "extensions.originalFailureMessage",
      "step store write timed out",
    );
    expect(effects).toEqual(["reserve-stock", "charge-card", "refund-card", "release-stock"]);
    expect(refundCalls).toBe(1);
    expect(publish).not.toHaveBeenCalled();
    expect(execution.status).toBe("compensated");
    expect(execution.error?.message).toBe("step store write timed out");
    expect(execution.steps.map((step) => step.status)).toEqual(["compensated", "compensated"]);
  });

  it.each([
    { fallbackRejectsUndefined: false, terminalWriteFails: false },
    { fallbackRejectsUndefined: true, terminalWriteFails: false },
    { fallbackRejectsUndefined: false, terminalWriteFails: true },
  ])(
    "compensates completed effects after both step writes fail ($fallbackRejectsUndefined, $terminalWriteFails)",
    async ({ fallbackRejectsUndefined, terminalWriteFails }) => {
      const delegate = new InMemorySagaStore();
      const completionError = new ProviderProblem("charge completion write unavailable");
      const fallbackError = fallbackRejectsUndefined
        ? undefined
        : new ProviderProblem("charge failure write unavailable");
      const terminalError = new ProviderProblem("terminal write unavailable");
      const store: SagaStore = {
        create: (params) => delegate.create(params),
        findById: (id) => delegate.findById(id),
        findByIdempotencyKey: (sagaName, key) => delegate.findByIdempotencyKey(sagaName, key),
        list: (options) => delegate.list(options),
        update: (id, data) => {
          const charge = data.steps?.find((step) => step.id === "charge-card");
          if (charge?.status === "completed") {
            return Promise.reject(completionError);
          }
          if (charge?.status === "failed") {
            return Promise.reject(fallbackError);
          }
          if (terminalWriteFails && data.status === "compensated") {
            return Promise.reject(terminalError);
          }
          return delegate.update(id, data);
        },
      };
      const effects: string[] = [];
      const publish = vi.fn();
      const nextStep = vi.fn();
      const definition: SagaDefinition = {
        name: "double-step-write-failure",
        outbox: { publish },
        steps: [
          {
            id: "reserve-stock",
            run: () => effects.push("reserve-stock"),
            compensate: () => effects.push("release-stock"),
          },
          {
            id: "charge-card",
            retry: { maxAttempts: 3 },
            run: (_input, { enqueueOutbox }) => {
              effects.push("charge-card");
              enqueueOutbox({ id: "charged", topic: "charged", payload: { chargeId: "ch_42" } });
              return { chargeId: "ch_42" };
            },
            compensate: (input, { stepResult }) => {
              expect(input).toEqual({ orderId: "ord_7" });
              expect(stepResult.result).toEqual({ chargeId: "ch_42" });
              effects.push("refund-card");
            },
          },
          { id: "send-receipt", run: nextStep },
        ],
      };
      const runner = new SagaRunner(store);

      const problem = await runner
        .execute(definition, { orderId: "ord_7" })
        .catch((error: unknown) => error);
      const [execution] = await runner.listExecutions({ sagaName: definition.name });

      expect(effects).toEqual(["reserve-stock", "charge-card", "refund-card", "release-stock"]);
      expect(nextStep).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
      expect(problem).toBeInstanceOf(SagaExecutionFailedProblem);
      expect(problem).toHaveProperty("extensions.originalFailureMessage", completionError.message);
      expect(execution.steps.map((step) => step.status)).toEqual(["compensated", "compensated"]);
      expect(execution.steps[1]?.result).toEqual({ chargeId: "ch_42" });
      expect(execution.steps[1]?.attempts).toBe(1);
      const recordingEvidence = Object.getOwnPropertyDescriptor(problem, "sagaFailureRecordError");
      expect(recordingEvidence?.enumerable).toBe(false);
      if (terminalWriteFails) {
        expect(recordingEvidence?.value).toBeInstanceOf(AggregateError);
        expect(recordingEvidence?.value.errors).toEqual([fallbackError, terminalError]);
      } else {
        expect(recordingEvidence?.value).toBe(fallbackError);
        expect(execution.status).toBe("compensated");
        expect(execution.error?.message).toBe(completionError.message);
      }
    },
  );

  it("reports a failed compensation after a successful step's completion write failed", async () => {
    const delegate = new InMemorySagaStore();
    let rejectCompletion = true;
    const store: SagaStore = {
      create: (params) => delegate.create(params),
      findById: (id) => delegate.findById(id),
      findByIdempotencyKey: (sagaName, key) => delegate.findByIdempotencyKey(sagaName, key),
      list: (options) => delegate.list(options),
      update: (id, data) => {
        if (rejectCompletion && data.steps?.some((step) => step.status === "completed")) {
          rejectCompletion = false;
          throw new Error("step store write timed out");
        }
        return delegate.update(id, data);
      },
    };
    let refundCalls = 0;
    const definition: SagaDefinition = {
      name: "failed-compensation-after-completion-write-failure",
      steps: [
        {
          id: "charge-card",
          run: () => ({ chargeId: "ch_1" }),
          compensate: (_input, { stepResult }) => {
            refundCalls += 1;
            expect(stepResult.result).toEqual({ chargeId: "ch_1" });
            throw new CompensationProblem("refund provider unavailable");
          },
        },
      ],
    };
    const runner = new SagaRunner(store);

    const problem = await runner.execute(definition, {}).catch((error: unknown) => error);
    const [execution] = await runner.listExecutions({ sagaName: definition.name });

    expect(refundCalls).toBe(1);
    expect(problem).toBeInstanceOf(SagaExecutionFailedProblem);
    expect(problem).toHaveProperty(
      "extensions.originalFailureMessage",
      "step store write timed out",
    );
    expect(problem).toHaveProperty("extensions.compensationFailureCount", 1);
    expect(execution.status).toBe("failed");
    expect(execution.error?.message).toBe("step store write timed out");
    expect(execution.compensationFailures).toEqual([
      expect.objectContaining({ message: "refund provider unavailable" }),
    ]);
    expect(execution.steps[0]).toEqual(
      expect.objectContaining({
        status: "compensation_failed",
        compensationError: expect.objectContaining({ message: "refund provider unavailable" }),
      }),
    );
  });

  it("does not compensate successful steps when the final completed-status write fails", async () => {
    const delegate = new InMemorySagaStore();
    let rejectFinalWrite = true;
    const store: SagaStore = {
      create: (params) => delegate.create(params),
      findById: (id) => delegate.findById(id),
      findByIdempotencyKey: (sagaName, key) => delegate.findByIdempotencyKey(sagaName, key),
      list: (options) => delegate.list(options),
      update: (id, data) => {
        if (rejectFinalWrite && data.status === "completed") {
          rejectFinalWrite = false;
          throw new ProviderProblem("completion store unavailable");
        }
        return delegate.update(id, data);
      },
    };
    const effects: string[] = [];
    const definition: SagaDefinition = {
      name: "finalization-store-failure",
      steps: [
        {
          id: "charge",
          run: () => {
            effects.push("charge");
            return { charged: true };
          },
          compensate: () => {
            effects.push("refund");
            return { refunded: true };
          },
        },
      ],
    };
    const runner = new SagaRunner(store);

    const problem = await runner.execute(definition, {}).catch((error: unknown) => error);

    expect(problem).toBeInstanceOf(SagaFinalizationProblem);
    expect(problem).toHaveProperty("code", "workflow-core/saga-finalization-failed");
    expect(effects).toEqual(["charge"]);
    const [execution] = await runner.listExecutions({ sagaName: definition.name });
    expect(execution.status).toBe("completing");
    expect(execution.steps[0]).toEqual(
      expect.objectContaining({
        status: "completed",
        result: { charged: true },
      }),
    );
  });

  it("finalizes a completion-failed saga on idempotent retry without rerunning steps", async () => {
    const delegate = new InMemorySagaStore();
    let rejectFinalWrite = true;
    const store: SagaStore = {
      create: (params) => delegate.create(params),
      findById: (id) => delegate.findById(id),
      findByIdempotencyKey: (sagaName, key) => delegate.findByIdempotencyKey(sagaName, key),
      list: (options) => delegate.list(options),
      update: (id, data) => {
        if (rejectFinalWrite && data.status === "completed") {
          rejectFinalWrite = false;
          throw new ProviderProblem("completion store unavailable");
        }
        return delegate.update(id, data);
      },
    };
    const effects: string[] = [];
    const definition: SagaDefinition = {
      name: "finalization-idempotent-retry",
      idempotencyKey: ({ payload }) => `finalization-retry:${getOrderId(payload)}`,
      steps: [
        {
          id: "charge",
          run: () => {
            effects.push("charge");
            return { charged: true };
          },
          compensate: () => {
            effects.push("refund");
            return { refunded: true };
          },
        },
      ],
    };
    const runner = new SagaRunner(store);

    await expect(runner.execute(definition, { orderId: "ord_123" })).rejects.toThrow(
      SagaFinalizationProblem,
    );

    const retried = await runner.execute(definition, { orderId: "ord_123" });

    expect(effects).toEqual(["charge"]);
    expect(retried.reused).toBe(true);
    expect(retried.execution.status).toBe("completed");
    expect(retried.result).toEqual({
      sagaName: "finalization-idempotent-retry",
      steps: [{ stepId: "charge", result: { charged: true } }],
    });
    const [execution] = await runner.listExecutions({ sagaName: definition.name });
    expect(execution.status).toBe("completed");
  });

  it("keeps successful steps durable when the completing marker itself fails", async () => {
    const delegate = new InMemorySagaStore();
    const store: SagaStore = {
      create: (params) => delegate.create(params),
      findById: (id) => delegate.findById(id),
      findByIdempotencyKey: (sagaName, key) => delegate.findByIdempotencyKey(sagaName, key),
      list: (options) => delegate.list(options),
      update: (id, data) => {
        if (data.status === "completing" || data.status === "completed") {
          throw new ProviderProblem("completion store unavailable");
        }
        return delegate.update(id, data);
      },
    };
    const effects: string[] = [];
    const definition: SagaDefinition = {
      name: "completing-marker-failure",
      steps: [
        {
          id: "charge",
          run: () => {
            effects.push("charge");
            return { charged: true };
          },
          compensate: () => {
            effects.push("refund");
            return { refunded: true };
          },
        },
      ],
    };
    const runner = new SagaRunner(store);

    await expect(runner.execute(definition, {})).rejects.toThrow(SagaFinalizationProblem);

    expect(effects).toEqual(["charge"]);
    const [execution] = await runner.listExecutions({ sagaName: definition.name });
    expect(execution.status).toBe("running");
    expect(execution.steps[0]).toEqual(
      expect.objectContaining({
        status: "completed",
        result: { charged: true },
      }),
    );
  });

  it("retains deterministic outbox delivery identity across replay", async () => {
    const deliveryIds: string[] = [];
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "deterministic-replay-outbox",
      outbox: {
        publish: (message) => {
          deliveryIds.push(message.deliveryId);
        },
      },
      steps: [
        {
          id: "reserve-payment",
          run: (_input, { enqueueOutbox }) => {
            enqueueOutbox({
              id: "payment-reserved",
              topic: "billing.reserved",
              payload: { orderId: "ord_123" },
            });
            return { paymentId: "pay_123" };
          },
          compensate: (_input, { enqueueOutbox }) => {
            enqueueOutbox({
              id: "payment-refunded",
              topic: "billing.refunded",
              payload: { orderId: "ord_123" },
            });
            return { refunded: true };
          },
        },
        {
          id: "provision-seat",
          run: () => {
            throw new ProviderProblem("seat provider unavailable");
          },
        },
      ],
    };

    await expect(runner.execute(definition, { orderId: "ord_123" })).rejects.toThrow(
      SagaExecutionFailedProblem,
    );
    const [failed] = await runner.listExecutions({ sagaName: definition.name });
    await runner.dispatchOutbox(definition, failed.id);

    await expect(runner.replay(definition, failed.id)).rejects.toThrow(SagaExecutionFailedProblem);
    const [replayed] = await runner.listExecutions({ replayOf: failed.id });
    await runner.dispatchOutbox(definition, replayed.id);

    expect(replayed.status).toBe("compensated");
    expect(deliveryIds).toHaveLength(2);
    expect(new Set(deliveryIds).size).toBe(1);
    expect(replayed.steps[0]?.outboxMessages.map((message) => message.deliveryId)).toEqual(
      failed.steps[0]?.outboxMessages.map((message) => message.deliveryId),
    );
  });

  it("delivers changed replay messages while preserving legacy identities for equal content", async () => {
    const store = new InMemorySagaStore();
    const runner = new SagaRunner(store);
    const delivered = new Map<string, unknown>();
    const publishAttempts: string[] = [];
    const definition: SagaDefinition = {
      name: "semantic-replay-outbox",
      outbox: {
        publish: (message) => {
          publishAttempts.push(message.deliveryId);
          if (!delivered.has(message.deliveryId))
            delivered.set(message.deliveryId, message.payload);
        },
      },
      steps: [
        {
          id: "reserve",
          run: () => "reserved",
          compensate: (_input, { payload, enqueueOutbox }) => {
            enqueueOutbox({ id: "refund", topic: "refunds", payload });
          },
        },
        {
          id: "fail",
          run: () => {
            throw new ProviderProblem("unavailable");
          },
        },
      ],
    };
    await expect(runner.execute(definition, { orderId: "order-A", amount: 12 })).rejects.toThrow(
      SagaExecutionFailedProblem,
    );
    const [original] = await runner.listExecutions({ replayOf: null });
    // An independently constructed historical record, before content-aware identities existed.
    const legacyId = `${original.id}:reserve:compensation:0:refund`;
    await store.update(original.id, {
      steps: original.steps.map((step) => ({
        ...step,
        outboxMessages: step.outboxMessages.map((message) => ({
          ...message,
          deliveryId: legacyId,
        })),
      })),
    });
    delivered.clear();
    delivered.set(legacyId, original.payload);
    await runner.dispatchOutbox(definition, original.id);

    await expect(
      runner.replay(definition, original.id, { payload: { amount: 12, orderId: "order-A" } }),
    ).rejects.toThrow(SagaExecutionFailedProblem);
    const [same] = await runner.listExecutions({ replayOf: original.id });
    expect(same.steps[0]?.outboxMessages[0]?.deliveryId).toBe(legacyId);
    await runner.dispatchOutbox(definition, same.id);
    expect(delivered.size).toBe(1);

    await expect(
      runner.replay(definition, same.id, { payload: { orderId: "order-B", amount: 23 } }),
    ).rejects.toThrow(SagaExecutionFailedProblem);
    const [changed] = await runner.listExecutions({ replayOf: same.id });
    const changedId = changed.steps[0]?.outboxMessages[0]?.deliveryId;
    expect(changedId).not.toBe(legacyId);
    await runner.dispatchOutbox(definition, changed.id);
    await runner.dispatchOutbox(definition, changed.id);
    expect([...delivered.values()]).toEqual([
      { orderId: "order-A", amount: 12 },
      { orderId: "order-B", amount: 23 },
    ]);
    expect((await runner.getExecution(changed.id)).steps[0]?.outboxMessages[0]?.status).toBe(
      "published",
    );

    await expect(runner.replay(definition, changed.id)).rejects.toThrow(SagaExecutionFailedProblem);
    const [repeated] = await runner.listExecutions({ replayOf: changed.id });
    expect(repeated.steps[0]?.outboxMessages[0]?.deliveryId).toBe(changedId);
    await runner.dispatchOutbox(definition, repeated.id);
    expect(delivered.size).toBe(2);

    // Historical buggy replays could already have assigned one legacy ID to different content.
    await store.update(repeated.id, {
      steps: repeated.steps.map((step) => ({
        ...step,
        outboxMessages: step.outboxMessages.map((message) => ({
          ...message,
          deliveryId: legacyId,
        })),
      })),
    });
    await expect(
      runner.replay(definition, repeated.id, { payload: original.payload }),
    ).rejects.toThrow(SagaExecutionFailedProblem);
    const [conflicted] = await runner.listExecutions({ replayOf: repeated.id });
    expect(conflicted.compensationFailures).toEqual([
      expect.objectContaining({ message: expect.stringContaining("conflicting message content") }),
    ]);
    expect(delivered.size).toBe(2);

    // A pre-upgrade replay may already contain a pending conflicting legacy delivery.
    await store.update(changed.id, {
      steps: changed.steps.map((step) => ({
        ...step,
        outboxMessages: step.outboxMessages.map((message) => ({
          ...message,
          deliveryId: legacyId,
          status: "pending" as const,
        })),
      })),
    });
    const attemptsBeforeConflict = publishAttempts.length;
    await expect(runner.dispatchOutbox(definition, changed.id)).rejects.toThrow(
      "conflicting message content",
    );
    expect(publishAttempts).toHaveLength(attemptsBeforeConflict);
    expect((await runner.getExecution(changed.id)).steps[0]?.outboxMessages[0]?.status).toBe(
      "pending",
    );
  });

  it("snapshots message content independently of mutable execution input and metadata", async () => {
    const runner = new SagaRunner();
    const delivered = new Map<string, { payload: unknown; metadata: unknown }>();
    const input = { amount: 12 };
    const metadata = { account: "account-A" };
    const definition: SagaDefinition = {
      name: "snapshot-replay-content",
      outbox: {
        publish: (message) => {
          if (!delivered.has(message.deliveryId)) {
            delivered.set(message.deliveryId, {
              payload: structuredClone(message.payload),
              metadata: structuredClone(message.metadata),
            });
          }
        },
      },
      steps: [
        {
          id: "mutate-input-after-enqueue",
          run: () => "prepared",
          compensate: () => {
            input.amount = 99;
            metadata.account = "changed-by-later-compensation";
          },
        },
        {
          id: "reserve",
          run: () => "reserved",
          compensate: (_input, context) => {
            context.enqueueOutbox({
              id: "refund",
              topic: "refunds",
              payload: context.payload,
              metadata,
            });
          },
        },
        {
          id: "fail",
          run: () => {
            throw new ProviderProblem("unavailable");
          },
        },
      ],
    };
    await expect(runner.execute(definition, input)).rejects.toThrow(SagaExecutionFailedProblem);
    const [original] = await runner.listExecutions({ replayOf: null });
    input.amount = 23;
    metadata.account = "account-B";
    expect(original.steps[1]?.outboxMessages[0]?.payload).toEqual({ amount: 12 });
    expect(original.steps[1]?.outboxMessages[0]?.metadata).toEqual({ account: "account-A" });
    await expect(runner.replay(definition, original.id, { payload: input })).rejects.toThrow(
      SagaExecutionFailedProblem,
    );
    expect([...delivered.values()]).toEqual([
      { payload: { amount: 12 }, metadata: { account: "account-A" } },
      { payload: { amount: 23 }, metadata: { account: "account-B" } },
    ]);
  });

  it("compensates a successful forward effect when outbox identity validation fails", async () => {
    const runner = new SagaRunner();
    const effects: string[] = [];
    const publish = vi.fn();
    const definition: SagaDefinition = {
      name: "identity-finalization-failure",
      outbox: { publish },
      steps: [
        {
          id: "charge",
          run: (_input, context) => {
            effects.push("charge");
            context.enqueueOutbox({
              id: "charged",
              topic: "charges",
              payload: new Map([["amount", 12]]),
            });
            return { charged: true };
          },
          compensate: () => {
            effects.push("refund");
          },
        },
      ],
    };
    await expect(runner.execute(definition, {})).rejects.toThrow(SagaExecutionFailedProblem);
    const [execution] = await runner.listExecutions({ replayOf: null });
    expect(effects).toEqual(["charge", "refund"]);
    expect(execution.status).toBe("compensated");
    expect(execution.steps[0]?.result).toEqual({ charged: true });
    expect(execution.steps[0]?.outboxMessages).toEqual([]);
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    { topic: "refunds.changed" },
    { idempotencyKey: "refund-B" },
    { metadata: { destination: "account-B" } },
    { payload: [null] },
    { payload: Object.assign([undefined], { account: "account-B" }) },
    { payload: { amount: BigInt(12) } },
    { payload: new Date("2026-01-02T03:04:05Z") },
  ])("distinguishes semantic message changes %o", async (change) => {
    const runner = new SagaRunner();
    const delivered = new Set<string>();
    let message: SagaOutboxMessage = {
      id: "refund",
      topic: "refunds",
      payload: [undefined],
      idempotencyKey: "refund-A",
      metadata: { destination: "account-A" },
    };
    const definition: SagaDefinition = {
      name: "changed-message-content",
      outbox: {
        publish: (record) => {
          delivered.add(record.deliveryId);
        },
      },
      steps: [
        {
          id: "reserve",
          run: () => "reserved",
          compensate: (_input, context) => {
            context.enqueueOutbox(message);
          },
        },
        {
          id: "fail",
          run: () => {
            throw new ProviderProblem("unavailable");
          },
        },
      ],
    };
    await expect(runner.execute(definition, {})).rejects.toThrow(SagaExecutionFailedProblem);
    const [original] = await runner.listExecutions({ replayOf: null });
    message = { ...message, ...change };
    await expect(runner.replay(definition, original.id)).rejects.toThrow(
      SagaExecutionFailedProblem,
    );
    const [changed] = await runner.listExecutions({ replayOf: original.id });
    expect(delivered.size).toBe(2);
    await expect(runner.replay(definition, changed.id)).rejects.toThrow(SagaExecutionFailedProblem);
    expect(delivered.size).toBe(2);
  });

  it("records compensation failures separately from the original step failure", async () => {
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "compensation-failure",
      steps: [
        {
          id: "create-payment",
          run: () => ({ paymentId: "pay_123" }),
          compensate: () => {
            throw new CompensationProblem("refund provider unavailable");
          },
        },
        {
          id: "provision-seat",
          run: () => {
            throw new ProviderProblem("seat provider unavailable");
          },
        },
      ],
    };

    await expect(runner.execute(definition, { orderId: "ord_123" })).rejects.toThrow(
      SagaExecutionFailedProblem,
    );

    const [execution] = await runner.listExecutions({ sagaName: definition.name });

    expect(execution.status).toBe("failed");
    expect(execution.error).toEqual(
      expect.objectContaining({
        code: "workflow-core/test-provider-problem",
        message: "seat provider unavailable",
      }),
    );
    expect(execution.compensationFailures).toEqual([
      expect.objectContaining({
        code: "workflow-core/test-compensation-problem",
        message: "refund provider unavailable",
      }),
    ]);
    expect(execution.steps).toEqual([
      expect.objectContaining({
        id: "create-payment",
        status: "compensation_failed",
        compensationError: expect.objectContaining({
          message: "refund provider unavailable",
        }),
      }),
      expect.objectContaining({
        id: "provision-seat",
        status: "failed",
        error: expect.objectContaining({
          message: "seat provider unavailable",
        }),
      }),
    ]);
  });

  it("normalizes a null compensation rejection without aborting the compensation chain", async () => {
    const effects: string[] = [];
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "null-compensation-rejection",
      steps: [
        {
          id: "reserve-payment",
          run: () => ({ paymentId: "pay_123" }),
          compensate: () => {
            effects.push("refund-payment");
            return { refunded: true };
          },
        },
        {
          id: "reserve-inventory",
          run: () => ({ reservationId: "res_123" }),
          compensate: () => {
            effects.push("release-inventory");
            throw null;
          },
        },
        {
          id: "notify-customer",
          run: () => {
            throw new ProviderProblem("notification provider unavailable");
          },
        },
      ],
    };

    const problem = await runner
      .execute(definition, { orderId: "ord_123" })
      .catch((error: unknown) => error);
    const [execution] = await runner.listExecutions({ sagaName: definition.name });

    expect(problem).toBeInstanceOf(SagaExecutionFailedProblem);
    expect(problem).toHaveProperty(
      "extensions.originalFailureMessage",
      "notification provider unavailable",
    );
    expect(problem).toHaveProperty("extensions.compensationFailureCount", 1);
    expect(problem).toHaveProperty("extensions.compensationFailures", [
      { message: "null", retryable: false },
    ]);
    expect(effects).toEqual(["release-inventory", "refund-payment"]);
    expect(execution.status).toBe("failed");
    expect(execution.error).toEqual(
      expect.objectContaining({
        code: "workflow-core/test-provider-problem",
        message: "notification provider unavailable",
      }),
    );
    expect(execution.compensationFailures).toEqual([{ message: "null", retryable: false }]);
    expect(execution.steps).toEqual([
      expect.objectContaining({
        id: "reserve-payment",
        status: "compensated",
      }),
      expect.objectContaining({
        id: "reserve-inventory",
        status: "compensation_failed",
        compensationError: { message: "null", retryable: false },
      }),
      expect.objectContaining({
        id: "notify-customer",
        status: "failed",
      }),
    ]);
  });

  it.each([
    { firstFails: false, terminalWriteFails: false },
    { firstFails: true, terminalWriteFails: false },
    { firstFails: true, terminalWriteFails: true },
  ])(
    "continues reverse compensation after recording failures ($firstFails, $terminalWriteFails)",
    async ({ firstFails, terminalWriteFails }) => {
      const delegate = new InMemorySagaStore();
      const effects: string[] = [];
      const recordErrors = [
        new ProviderProblem("second compensation record unavailable"),
        new ProviderProblem("first compensation record unavailable"),
      ];
      const terminalError = new ProviderProblem("terminal record unavailable");
      const store: SagaStore = {
        create: (params) => delegate.create(params),
        findById: (id) => delegate.findById(id),
        findByIdempotencyKey: (name, key) => delegate.findByIdempotencyKey(name, key),
        list: (options) => delegate.list(options),
        update: (id, data) => {
          const failedStep = data.steps?.find((step) => step.status === "compensation_failed");
          if (failedStep) {
            throw recordErrors[failedStep.id === "second" ? 0 : 1];
          }
          if (terminalWriteFails && data.status === "failed") {
            throw terminalError;
          }
          return delegate.update(id, data);
        },
      };
      const runner = new SagaRunner(store);
      const definition: SagaDefinition = {
        name: "compensation-record-failures",
        steps: [
          ...["first", "second"].map((id) => ({
            id,
            run: () => `${id}-result`,
            compensate: () => {
              effects.push(id);
              if (id === "second" || firstFails) {
                throw new CompensationProblem(`${id} refund unavailable`);
              }
              return "first-refunded";
            },
          })),
          {
            id: "third",
            run: () => {
              throw new ProviderProblem("third business failure");
            },
          },
        ],
      };

      const problem = await runner.execute(definition, {}).catch((error: unknown) => error);
      expect(effects).toEqual(["second", "first"]);
      expect(problem).toBeInstanceOf(SagaExecutionFailedProblem);
      expect(problem).toHaveProperty("extensions.originalFailureMessage", "third business failure");
      expect(problem).toHaveProperty("extensions.sagaStatus", "failed");
      expect(problem).toHaveProperty("extensions.compensationFailures", [
        {
          code: "workflow-core/test-compensation-problem",
          message: "second refund unavailable",
          retryable: false,
        },
        ...(firstFails
          ? [
              {
                code: "workflow-core/test-compensation-problem",
                message: "first refund unavailable",
                retryable: false,
              },
            ]
          : []),
      ]);
      if (firstFails) {
        expect(problem).toHaveProperty("sagaFailureRecordError", expect.any(AggregateError));
        const recordingError = (problem as { sagaFailureRecordError: AggregateError })
          .sagaFailureRecordError;
        expect(recordingError.errors).toEqual(
          terminalWriteFails ? [...recordErrors, terminalError] : recordErrors,
        );
      } else {
        expect(problem).toHaveProperty("sagaFailureRecordError", recordErrors[0]);
      }
      const [execution] = await runner.listExecutions({ sagaName: definition.name });
      expect(execution.status).toBe(terminalWriteFails ? "running" : "failed");
      expect(execution.steps.map((step) => [step.id, step.status])).toEqual([
        ["first", firstFails ? "compensating" : "compensated"],
        ["second", "compensating"],
        ["third", "failed"],
      ]);
      if (!terminalWriteFails) {
        expect(execution.error?.message).toBe("third business failure");
        expect(execution.compensationFailures.map((failure) => failure.message)).toEqual([
          "second refund unavailable",
          ...(firstFails ? ["first refund unavailable"] : []),
        ]);
      }
    },
  );

  it("defers outbox dispatch until recording failures have been reported", async () => {
    const delegate = new InMemorySagaStore();
    const recordError = new ProviderProblem("compensation record unavailable");
    const publishError = new ProviderProblem("outbox publisher unavailable");
    const publish = vi.fn().mockRejectedValue(publishError);
    const store: SagaStore = {
      create: (params) => delegate.create(params),
      findById: (id) => delegate.findById(id),
      findByIdempotencyKey: (name, key) => delegate.findByIdempotencyKey(name, key),
      list: (options) => delegate.list(options),
      update: (id, data) => {
        if (data.steps?.some((step) => step.status === "compensation_failed")) {
          throw recordError;
        }
        return delegate.update(id, data);
      },
    };
    const runner = new SagaRunner(store);
    const definition: SagaDefinition = {
      name: "recording-failure-with-outbox",
      outbox: { publish },
      steps: [
        {
          id: "first",
          run: () => "payment",
          compensate: (_input, context) => {
            context.enqueueOutbox({ id: "refund", topic: "refund", payload: { amount: 42 } });
          },
        },
        {
          id: "second",
          run: () => "inventory",
          compensate: () => {
            throw new CompensationProblem("release failed");
          },
        },
        {
          id: "third",
          run: () => {
            throw new ProviderProblem("business failure");
          },
        },
      ],
    };
    const problem = await runner.execute(definition, {}).catch((error: unknown) => error);
    expect(problem).toBeInstanceOf(SagaExecutionFailedProblem);
    expect(problem).toHaveProperty("extensions.originalFailureMessage", "business failure");
    expect(problem).toHaveProperty("extensions.compensationFailures", [
      {
        code: "workflow-core/test-compensation-problem",
        message: "release failed",
        retryable: false,
      },
    ]);
    expect(problem).toHaveProperty("sagaFailureRecordError", recordError);
    expect(publish).not.toHaveBeenCalled();
    const [execution] = await runner.listExecutions({ sagaName: definition.name });
    expect(execution.status).toBe("failed");
    expect(execution.steps[0]?.outboxMessages[0]?.status).toBe("pending");
    await expect(runner.dispatchOutbox(definition, execution.id)).rejects.toBe(publishError);
    expect((await runner.getExecution(execution.id)).steps[0]?.outboxMessages[0]?.status).toBe(
      "pending",
    );
    publish.mockResolvedValue(undefined);
    const recovered = await runner.dispatchOutbox(definition, execution.id);
    expect(recovered.steps[0]?.outboxMessages[0]?.status).toBe("published");
  });

  it.each([
    ["compensation bookkeeping", "compensating", "failed", undefined],
    [
      "compensation failure recording",
      "compensation_failed",
      "failed",
      "refund provider unavailable",
    ],
    ["terminal failure-state recording", "terminal", "compensated", undefined],
  ] as const)(
    "preserves the original saga failure when %s rejects",
    async (_failureKind, failurePoint, expectedStatus, compensationFailureMessage) => {
      const delegate = new InMemorySagaStore();
      const sagaFailure = new ProviderProblem("seat provider unavailable");
      const failureRecordError = new ProviderProblem("saga failure store unavailable");
      const compensationFailure =
        compensationFailureMessage === undefined
          ? undefined
          : new CompensationProblem(compensationFailureMessage);
      const store: SagaStore = {
        create: (params) => delegate.create(params),
        findById: (id) => delegate.findById(id),
        findByIdempotencyKey: (sagaName, key) => delegate.findByIdempotencyKey(sagaName, key),
        list: (options) => delegate.list(options),
        update: (id, data) => {
          const shouldReject =
            failurePoint === "terminal"
              ? data.status === "compensated"
              : data.steps?.some((step) => step.status === failurePoint);
          if (shouldReject) {
            throw failureRecordError;
          }

          return delegate.update(id, data);
        },
      };
      const mockSpan = createMockSpan();
      vi.spyOn(trace, "getTracer").mockReturnValue(createMockTracer([], mockSpan));
      const definition: SagaDefinition = {
        name: `failure-record-${failurePoint}`,
        steps: [
          {
            id: "reserve-payment",
            run: () => ({ paymentId: "pay_123" }),
            compensate: () => {
              if (compensationFailure !== undefined) {
                throw compensationFailure;
              }

              return { refunded: true };
            },
          },
          {
            id: "provision-seat",
            run: () => {
              throw sagaFailure;
            },
          },
        ],
      };
      const runner = new SagaRunner(store);

      const problem = await runner.execute(definition, {}).catch((error: unknown) => error);

      expect(problem).toBeInstanceOf(SagaExecutionFailedProblem);
      expect(problem).toMatchObject({
        code: "workflow-core/saga-execution-failed",
        extensions: {
          originalFailureCode: sagaFailure.code,
          originalFailureMessage: sagaFailure.message,
          sagaStatus: expectedStatus,
          compensationFailures:
            compensationFailure === undefined
              ? []
              : [
                  {
                    code: compensationFailure.code,
                    message: compensationFailure.message,
                    retryable: false,
                  },
                ],
        },
      });
      expect(Object.getOwnPropertyDescriptor(problem, "sagaFailureRecordError")).toEqual({
        configurable: true,
        enumerable: false,
        value: failureRecordError,
        writable: false,
      });
      expect(mockSpan.addEvent).toHaveBeenCalledWith("saga.execution.failure_record.failed", {
        "saga.name": definition.name,
        "saga.execution.id": "saga-1",
        "saga.error.message": sagaFailure.message,
        "saga.failure_record.error.message": failureRecordError.message,
      });
    },
  );

  it("records exhausted retry attempts and step idempotency keys", async () => {
    let attempts = 0;
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "retry-exhaustion",
      idempotencyKey: ({ payload }) => `retry-exhaustion:${getOrderId(payload)}`,
      steps: [
        {
          id: "charge-provider",
          retry: { maxAttempts: 2 },
          idempotencyKey: ({ executionId, stepInput }) =>
            `charge:${executionId}:${getOrderId(stepInput)}`,
          run: () => {
            attempts += 1;
            throw new RetryableProviderProblem("payment provider retryable outage");
          },
        },
      ],
    };

    await expect(runner.execute(definition, { orderId: "ord_123" })).rejects.toThrow(
      SagaExecutionFailedProblem,
    );

    const [execution] = await runner.listExecutions({ sagaName: definition.name });

    expect(attempts).toBe(2);
    expect(execution.status).toBe("failed");
    expect(execution.steps).toEqual([
      expect.objectContaining({
        id: "charge-provider",
        status: "failed",
        attempts: 2,
        maxAttempts: 2,
        idempotencyKey: `charge:${execution.id}:ord_123`,
        error: expect.objectContaining({
          retryable: true,
          message: "payment provider retryable outage",
        }),
      }),
    ]);

    await expect(runner.execute(definition, { orderId: "ord_123" })).rejects.toThrow(
      SagaExecutionFailedProblem,
    );
    expect(attempts).toBe(2);
    await expect(runner.listExecutions({ sagaName: definition.name })).resolves.toHaveLength(1);
  });

  it("retries standard Errors by default until the step succeeds", async () => {
    let attempts = 0;
    const store = new InMemorySagaStore();
    const runner = new SagaRunner(store);
    const definition: SagaDefinition = {
      name: "standard-error-retry",
      steps: [
        {
          id: "charge-provider",
          retry: { maxAttempts: 3 },
          run: () => {
            attempts += 1;
            if (attempts < 3) {
              throw new Error("payment provider temporarily unavailable");
            }
            return "charged";
          },
        },
      ],
    };

    const result = await runner.execute(definition, {});

    expect(attempts).toBe(3);
    expect(result.execution.status).toBe("completed");
    expect(result.steps).toEqual([{ stepId: "charge-provider", result: "charged" }]);
    const persisted = await store.findById(result.execution.id);
    expect(persisted?.steps[0]).toMatchObject({
      status: "completed",
      attempts: 3,
      result: "charged",
    });
    expect(persisted?.steps[0]).not.toHaveProperty("error");
  });

  it("records standard Errors as retryable when retries are exhausted", async () => {
    let attempts = 0;
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "standard-error-retry-exhaustion",
      steps: [
        {
          id: "charge-provider",
          retry: { maxAttempts: 3 },
          run: () => {
            attempts += 1;
            throw new Error("payment provider temporarily unavailable");
          },
        },
      ],
    };

    await expect(runner.execute(definition, {})).rejects.toThrow(SagaExecutionFailedProblem);

    const [execution] = await runner.listExecutions({ sagaName: definition.name });
    expect(attempts).toBe(3);
    expect(execution.error).toEqual(expect.objectContaining({ retryable: true }));
    expect(execution.steps[0]?.error).toEqual(expect.objectContaining({ retryable: true }));
  });

  it("uses a custom shouldRetry result before the default Error classification", async () => {
    let attempts = 0;
    const shouldRetry = vi.fn(() => false);
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "standard-error-custom-retry",
      steps: [
        {
          id: "charge-provider",
          retry: { maxAttempts: 3, shouldRetry },
          run: () => {
            attempts += 1;
            throw new Error("payment provider temporarily unavailable");
          },
        },
      ],
    };

    await expect(runner.execute(definition, {})).rejects.toThrow(SagaExecutionFailedProblem);

    expect(attempts).toBe(1);
    expect(shouldRetry).toHaveBeenCalledOnce();
    expect(shouldRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        saga: definition,
        attempt: 1,
        error: expect.objectContaining({
          message: "payment provider temporarily unavailable",
        }),
      }),
    );
  });

  it("retries Problems marked retryable through extensions", async () => {
    let attempts = 0;
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "problem-extension-retry",
      steps: [
        {
          id: "charge-provider",
          retry: { maxAttempts: 2 },
          run: () => {
            attempts += 1;
            if (attempts === 1) {
              throw new ExtensionRetryableProviderProblem(
                "payment provider retryable outage",
                true,
              );
            }
            return "charged";
          },
        },
      ],
    };

    const result = await runner.execute(definition, {});

    expect(attempts).toBe(2);
    expect(result.execution.status).toBe("completed");
    expect(result.steps).toEqual([{ stepId: "charge-provider", result: "charged" }]);
  });

  it("records extension retryability when Problem retries are exhausted", async () => {
    let attempts = 0;
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "problem-extension-retry-exhaustion",
      steps: [
        {
          id: "charge-provider",
          retry: { maxAttempts: 2 },
          run: () => {
            attempts += 1;
            throw new ExtensionRetryableProviderProblem("payment provider retryable outage", true);
          },
        },
      ],
    };

    await expect(runner.execute(definition, {})).rejects.toMatchObject({
      extensions: expect.objectContaining({ retryable: true }),
    });

    const [execution] = await runner.listExecutions({ sagaName: definition.name });
    expect(attempts).toBe(2);
    expect(execution.error).toEqual(expect.objectContaining({ retryable: true }));
    expect(execution.steps[0]?.error).toEqual(expect.objectContaining({ retryable: true }));
  });

  it.each([
    { extensionRetryable: true, retryable: false, expectedAttempts: 1 },
    { extensionRetryable: false, retryable: true, expectedAttempts: 2 },
  ])(
    "prefers top-level retryable=$retryable over extension retryable=$extensionRetryable",
    async ({ extensionRetryable, retryable, expectedAttempts }) => {
      let attempts = 0;
      const runner = new SagaRunner();
      const definition: SagaDefinition = {
        name: `problem-retry-precedence-${String(retryable)}`,
        steps: [
          {
            id: "charge-provider",
            retry: { maxAttempts: 2 },
            run: () => {
              attempts += 1;
              if (attempts < 2 || !retryable) {
                throw new DualShapeRetryableProviderProblem(
                  "payment provider outage",
                  retryable,
                  extensionRetryable,
                );
              }
              return "charged";
            },
          },
        ],
      };

      if (retryable) {
        await expect(runner.execute(definition, {})).resolves.toMatchObject({
          execution: { status: "completed" },
        });
      } else {
        await expect(runner.execute(definition, {})).rejects.toThrow(SagaExecutionFailedProblem);
      }
      expect(attempts).toBe(expectedAttempts);
    },
  );

  it.each([false, undefined])(
    "does not retry Problems without an affirmative retryable extension (%s)",
    async (retryable) => {
      let attempts = 0;
      const runner = new SagaRunner();
      const definition: SagaDefinition = {
        name: `problem-extension-non-retry-${String(retryable)}`,
        steps: [
          {
            id: "charge-provider",
            retry: { maxAttempts: 2 },
            run: () => {
              attempts += 1;
              throw new ExtensionRetryableProviderProblem(
                "payment provider non-retryable outage",
                retryable,
              );
            },
          },
        ],
      };

      await expect(runner.execute(definition, {})).rejects.toThrow(SagaExecutionFailedProblem);
      expect(attempts).toBe(1);
    },
  );

  it.each([
    {
      id: "undefined",
      signal: "a top-level retryable=undefined as undeclared",
      createError: () =>
        Object.assign(new Error("payment provider outage"), { retryable: undefined }),
      expectedAttempts: 2,
    },
    {
      id: "zero",
      signal: "a non-boolean top-level retryable=0 as undeclared",
      createError: () => Object.assign(new Error("payment provider outage"), { retryable: 0 }),
      expectedAttempts: 2,
    },
    {
      id: "extension-false",
      signal: "a standard Error extension retryable=false as terminal",
      createError: () =>
        Object.assign(new Error("payment provider outage"), {
          extensions: { retryable: false },
        }),
      expectedAttempts: 1,
    },
  ])("classifies $signal", async ({ id, createError, expectedAttempts }) => {
    let attempts = 0;
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: `explicit-retryability-${id}`,
      steps: [
        {
          id: "charge-provider",
          retry: { maxAttempts: 2 },
          run: () => {
            attempts += 1;
            throw createError();
          },
        },
      ],
    };

    await expect(runner.execute(definition, {})).rejects.toThrow(SagaExecutionFailedProblem);
    expect(attempts).toBe(expectedAttempts);
  });

  it("rejects changed payloads instead of reusing a completed execution", async () => {
    const run = vi.fn((input) => input);
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "payload-binding",
      idempotencyKey: "order-123",
      steps: [{ id: "charge", run }],
    };
    const first = await runner.execute(definition, { quantity: 1, product: "seat" });
    await expect(
      runner.execute(definition, { product: "seat", quantity: 1 }),
    ).resolves.toMatchObject({
      executionId: first.executionId,
      reused: true,
    });
    await expect(
      runner.execute(definition, { quantity: 99, product: "seat" }),
    ).rejects.toMatchObject({
      code: "workflow-core/saga-store-conflict",
      category: ProblemCategory.Conflict,
      extensions: { executionId: first.executionId, retryable: false },
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it.each(["pending", "running", "completing", "completed", "failed", "compensated"] as const)(
    "rejects a changed payload before recovering a legacy %s execution",
    async (status) => {
      const store = new InMemorySagaStore();
      const execution = await store.create({
        sagaName: "legacy-binding",
        idempotencyKey: "key",
        payload: { quantity: 1 },
      });
      await store.update(execution.id, { status });
      const before = structuredClone(await store.findById(execution.id));
      const run = vi.fn();
      const publish = vi.fn();
      const definition: SagaDefinition = {
        name: execution.sagaName,
        idempotencyKey: "key",
        outbox: { publish },
        steps: [{ id: "charge", run }],
      };
      await expect(
        new SagaRunner(store).execute(definition, { quantity: 99 }),
      ).rejects.toMatchObject({
        code: "workflow-core/saga-store-conflict",
        extensions: { retryable: false },
      });
      expect(await store.findById(execution.id)).toEqual(before);
      expect(run).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it.each(["pending", "running", "completing", "completed", "failed", "compensated"] as const)(
    "checks persisted identity before reusing a %s execution",
    async (status) => {
      const store = new InMemorySagaStore();
      const runner = new SagaRunner(store);
      const run = vi.fn(() => "charged");
      const definition: SagaDefinition = {
        name: "persisted-binding",
        idempotencyKey: "key",
        steps: [{ id: "charge", run }],
      };
      const first = await runner.execute(definition, { quantity: 1 });
      await store.update(first.executionId, { status });
      const before = structuredClone(await store.findById(first.executionId));
      await expect(runner.execute(definition, { quantity: 99 })).rejects.toMatchObject({
        code: "workflow-core/saga-store-conflict",
      });
      expect(await store.findById(first.executionId)).toEqual(before);
      expect(run).toHaveBeenCalledTimes(1);
    },
  );

  it("reuses an equal legacy payload without rewriting the record", async () => {
    const store = new InMemorySagaStore();
    const execution = await store.create({
      sagaName: "legacy-equal",
      idempotencyKey: "key",
      payload: { quantity: 3, product: "seat" },
    });
    await store.update(execution.id, { status: "completed", result: "old-result" });
    const before = structuredClone(await store.findById(execution.id));
    const run = vi.fn();
    await expect(
      new SagaRunner(store).execute(
        {
          name: execution.sagaName,
          idempotencyKey: "key",
          steps: [{ id: "charge", run }],
        },
        { product: "seat", quantity: 3 },
      ),
    ).resolves.toMatchObject({ reused: true, result: "old-result" });
    expect(await store.findById(execution.id)).toEqual(before);
    expect(run).not.toHaveBeenCalled();
  });

  it.each(["", "order-123"])(
    "rejects different payloads in a create race for key %j",
    async (key) => {
      const store = new InMemorySagaStore();
      const lookups = createGate();
      let count = 0;
      vi.spyOn(store, "findByIdempotencyKey").mockImplementation(async () => {
        if (++count === 2) lookups.release();
        await lookups.promise;
        return null;
      });
      const run = vi.fn((input) => input);
      const definition: SagaDefinition = {
        name: "racing-payloads",
        idempotencyKey: key,
        steps: [{ id: "charge", run }],
      };
      const results = await Promise.allSettled([
        new SagaRunner(store).execute(definition, { quantity: 1 }),
        new SagaRunner(store).execute(definition, { quantity: 99 }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const failure = results.find((result) => result.status === "rejected");
      expect(failure).toMatchObject({
        status: "rejected",
        reason: {
          code: "workflow-core/saga-store-conflict",
          extensions: { retryable: false },
        },
      });
      expect(run).toHaveBeenCalledTimes(1);
      expect(await store.list()).toHaveLength(1);
      const [execution] = await store.list();
      expect(execution.requestFingerprint).toMatch(/^saga-request:v1:[0-9a-f]{64}$/);
      expect(run).toHaveBeenCalledWith(execution.payload, expect.anything());
    },
  );

  it("binds the original snapshot even when the caller and handler mutate their payloads", async () => {
    const payload = { quantity: 3 };
    const store = new InMemorySagaStore();
    const runner = new SagaRunner(store);
    const run = vi.fn((input: unknown) => {
      (input as { quantity: number }).quantity = 5;
      return "charged";
    });
    const definition: SagaDefinition = {
      name: "snapshot-binding",
      idempotencyKey: "key",
      steps: [{ id: "charge", run }],
    };
    const primary = runner.execute(definition, payload);
    payload.quantity = 99;
    const first = await primary;
    expect(first.execution.payload).toEqual({ quantity: 5 });
    await expect(runner.execute(definition, { quantity: 3 })).resolves.toMatchObject({
      reused: true,
    });
    await expect(runner.execute(definition, { quantity: 5 })).rejects.toMatchObject({
      code: "workflow-core/saga-store-conflict",
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it.each([
    [undefined, null],
    [0, -0],
    [NaN, "NaN"],
    [BigInt(1), "1"],
    [new Date("2030-01-01"), "2030-01-01T00:00:00.000Z"],
    [
      [1, 2],
      [2, 1],
    ],
    [Array(1), [undefined]],
  ])("distinguishes canonical payload values %#", async (first, changed) => {
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "typed-payload",
      idempotencyKey: "key",
      steps: [{ id: "charge", run: () => "charged" }],
    };
    await runner.execute(definition, first);
    await expect(runner.execute(definition, changed)).rejects.toMatchObject({
      code: "workflow-core/saga-store-conflict",
    });
  });

  it.each([() => {}, Symbol("payload"), new Map([["quantity", 3]]), new Date(NaN)])(
    "rejects unsupported keyed payload %# before creating an execution",
    async (payload) => {
      const store = new InMemorySagaStore();
      const run = vi.fn();
      await expect(
        new SagaRunner(store).execute(
          { name: "unsupported-payload", idempotencyKey: "key", steps: [{ id: "charge", run }] },
          payload,
        ),
      ).rejects.toThrow(SagaDefinitionProblem);
      expect(await store.list()).toEqual([]);
      expect(run).not.toHaveBeenCalled();
    },
  );

  it("scopes saga idempotency keys by saga name", async () => {
    const events: string[] = [];
    const runner = new SagaRunner();
    const firstDefinition: SagaDefinition = {
      name: "first-saga",
      idempotencyKey: () => "shared-idempotency-key",
      steps: [
        {
          id: "first-step",
          run: () => {
            events.push("first");
            return { saga: "first" };
          },
        },
      ],
    };
    const secondDefinition: SagaDefinition = {
      name: "second-saga",
      idempotencyKey: () => "shared-idempotency-key",
      steps: [
        {
          id: "second-step",
          run: () => {
            events.push("second");
            return { saga: "second" };
          },
        },
      ],
    };

    const first = await runner.execute(firstDefinition, {});
    const second = await runner.execute(secondDefinition, {});

    expect(first.executionId).not.toBe(second.executionId);
    expect(events).toEqual(["first", "second"]);
    await expect(runner.listExecutions()).resolves.toHaveLength(2);
  });

  it.each(["concurrent-key", ""])(
    "rejects the losing create race for idempotency key %j without duplicate side effects",
    async (idempotencyKey) => {
      const gate = createGate();
      const store = new InMemorySagaStore();
      const create = vi.spyOn(store, "create");
      const lookups = createGate();
      let lookupCount = 0;
      vi.spyOn(store, "findByIdempotencyKey").mockImplementation(async () => {
        if (++lookupCount === 2) lookups.release();
        await lookups.promise;
        return null;
      });
      const run = vi.fn(async () => {
        await gate.promise;
        return { handled: true };
      });
      const runner = new SagaRunner(store);
      const definition: SagaDefinition = {
        name: "concurrent-idempotency",
        idempotencyKey,
        steps: [{ id: "slow-provider-call", run }],
      };

      const first = runner.execute(definition, {});
      const second = expect(runner.execute(definition, {})).rejects.toMatchObject({
        code: "workflow-core/saga-execution-in-flight",
        category: ProblemCategory.Conflict,
        extensions: {
          sagaName: definition.name,
          executionId: expect.any(String),
          sagaStatus: "pending",
          retryable: true,
        },
      });
      try {
        await second;
      } finally {
        gate.release();
        await first;
      }

      const result = await first;
      const executions = await runner.listExecutions({ sagaName: definition.name });
      expect(result.execution.status).toBe("completed");
      expect(result.reused).toBe(false);
      expect(create).toHaveBeenCalledTimes(2);
      expect(run).toHaveBeenCalledTimes(1);
      expect(executions).toHaveLength(1);
      expect(executions[0]?.idempotencyKey).toBe(idempotencyKey);
    },
  );

  it("rejects running reuse without dispatching outbox messages", async () => {
    const gate = createGate();
    const started = createGate();
    const publish = vi.fn();
    const run = vi.fn(async (_input, { enqueueOutbox }) => {
      enqueueOutbox({ id: "payment-reserved", topic: "billing.reserved", payload: {} });
      started.release();
      await gate.promise;
      return { paymentId: "pay_123" };
    });
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "concurrent-outbox-reuse",
      idempotencyKey: "concurrent-outbox-reuse:ord_123",
      outbox: { publish },
      steps: [{ id: "reserve-payment", run }],
    };

    const primary = runner.execute(definition, {});
    try {
      await started.promise;
      const [running] = await runner.listExecutions({ sagaName: definition.name });
      await expect(runner.execute(definition, {})).rejects.toMatchObject({
        code: "workflow-core/saga-execution-in-flight",
        category: ProblemCategory.Conflict,
        extensions: {
          sagaName: definition.name,
          executionId: running.id,
          sagaStatus: "running",
          retryable: true,
        },
      });
      expect(publish).not.toHaveBeenCalled();
      await expect(runner.dispatchOutbox(definition, running.id)).rejects.toThrow(
        "cannot dispatch outbox messages while 'running'",
      );
    } finally {
      gate.release();
      await primary;
    }
    expect((await primary).execution.status).toBe("completed");
    expect(run).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it.each(["pending", "running"] as const)(
    "rejects a stored %s execution without mutation or success reuse telemetry",
    async (status) => {
      const store = new InMemorySagaStore();
      const execution = await store.create({
        sagaName: "stored-in-flight",
        payload: {},
        idempotencyKey: "key",
      });
      await store.update(execution.id, { status });
      const before = structuredClone(await store.findById(execution.id));
      const update = vi.spyOn(store, "update");
      const create = vi.spyOn(store, "create");
      const span = createMockSpan();
      vi.spyOn(trace, "getTracer").mockReturnValue(createMockTracer([], span));
      const run = vi.fn();
      const publish = vi.fn();
      const runner = new SagaRunner(store);
      const definition: SagaDefinition = {
        name: execution.sagaName,
        idempotencyKey: "key",
        outbox: { publish },
        steps: [{ id: "step", run }],
      };

      await expect(runner.execute(definition, {})).rejects.toMatchObject({
        code: "workflow-core/saga-execution-in-flight",
        category: ProblemCategory.Conflict,
        extensions: {
          sagaName: execution.sagaName,
          executionId: execution.id,
          sagaStatus: status,
          retryable: true,
        },
      });
      expect(await store.findById(execution.id)).toEqual(before);
      expect(update).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(run).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
      expect(span.setAttribute).not.toHaveBeenCalledWith("saga.reused", true);
      expect(span.addEvent).not.toHaveBeenCalledWith("saga.execution.reused", expect.anything());
    },
  );

  it("rejects reuse while real compensation is paused without repeating effects", async () => {
    const gate = createGate();
    const started = createGate();
    const reserve = vi.fn(() => "reserved");
    const compensate = vi.fn(async () => {
      started.release();
      await gate.promise;
    });
    const fail = vi.fn(() => {
      throw new ProviderProblem("provider failed");
    });
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "compensating-reuse",
      idempotencyKey: "key",
      steps: [
        { id: "reserve", run: reserve, compensate },
        { id: "fail", run: fail },
      ],
    };
    const primary = expect(runner.execute(definition, {})).rejects.toThrow(
      SagaExecutionFailedProblem,
    );
    try {
      await started.promise;
      const [execution] = await runner.listExecutions({ sagaName: definition.name });
      expect(execution.status).toBe("running");
      expect(execution.steps[0]?.status).toBe("compensating");
      await expect(runner.execute(definition, {})).rejects.toMatchObject({
        code: "workflow-core/saga-execution-in-flight",
        category: ProblemCategory.Conflict,
        extensions: {
          sagaName: definition.name,
          executionId: execution.id,
          sagaStatus: "running",
          retryable: true,
        },
      });
    } finally {
      gate.release();
      await primary;
    }
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(compensate).toHaveBeenCalledTimes(1);
    const [execution] = await runner.listExecutions({ sagaName: definition.name });
    expect(execution.status).toBe("compensated");
  });

  it("reuses completed execution results without rerunning steps", async () => {
    const run = vi.fn(() => ({ paymentId: "pay_123" }));
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "completed-reuse",
      idempotencyKey: "key",
      steps: [{ id: "charge", run }],
    };
    const first = await runner.execute(definition, {});
    await expect(runner.execute(definition, {})).resolves.toMatchObject({
      executionId: first.executionId,
      execution: { status: "completed" },
      steps: first.steps,
      result: first.result,
      reused: true,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it.each(["failed", "compensated"] as const)(
    "preserves stored %s execution failure on reuse",
    async (status) => {
      const store = new InMemorySagaStore();
      const execution = await store.create({
        sagaName: "stored-failure",
        payload: {},
        idempotencyKey: "key",
      });
      await store.update(execution.id, {
        status,
        error: { message: "provider failed", code: "provider/failure", retryable: false },
      });
      const run = vi.fn();
      const runner = new SagaRunner(store);
      const definition: SagaDefinition = {
        name: execution.sagaName,
        idempotencyKey: "key",
        steps: [{ id: "charge", run }],
      };
      await expect(runner.execute(definition, {})).rejects.toMatchObject({
        code: "workflow-core/saga-execution-failed",
        extensions: expect.objectContaining({
          sagaStatus: status,
          originalFailureCode: "provider/failure",
          retryable: false,
        }),
      });
      expect(run).not.toHaveBeenCalled();
    },
  );

  it("replays a failed saga execution without durable adapter dependencies", async () => {
    let providerRecovered = false;
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "replayable-seat-change",
      steps: [
        {
          id: "provision-seat",
          run: (input) => {
            if (!providerRecovered) {
              throw new ProviderProblem("seat provider unavailable");
            }

            return { provisioned: getOrderId(input) };
          },
        },
      ],
    };

    await expect(runner.execute(definition, { orderId: "ord_123" })).rejects.toThrow(
      SagaExecutionFailedProblem,
    );
    const [failedExecution] = await runner.listExecutions({ sagaName: definition.name });
    providerRecovered = true;

    const replayed = await runner.replay(definition, failedExecution.id, {
      reason: "provider recovered",
    });
    const executions = await runner.listExecutions({ sagaName: definition.name });
    const originalExecutions = await runner.listExecutions({ replayOf: null });
    const replayExecutions = await runner.listExecutions({ replayOf: failedExecution.id });

    expect(replayed.execution).toEqual(
      expect.objectContaining({
        status: "completed",
        replayOf: failedExecution.id,
        metadata: expect.objectContaining({
          replayOf: failedExecution.id,
          replayReason: "provider recovered",
        }),
      }),
    );
    expect(replayed.steps).toEqual([
      {
        stepId: "provision-seat",
        result: { provisioned: "ord_123" },
      },
    ]);
    expect(executions).toHaveLength(2);
    expect(originalExecutions).toEqual([failedExecution]);
    expect(replayExecutions).toEqual([replayed.execution]);
  });

  it("rejects replay for completed saga executions", async () => {
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "completed-replay-rejection",
      steps: [
        {
          id: "complete-step",
          run: () => ({ completed: true }),
        },
      ],
    };

    const completed = await runner.execute(definition, {});

    await expect(runner.replay(definition, completed.executionId)).rejects.toThrow(
      "execution in 'completed' status is not replayable",
    );
    await expect(runner.listExecutions({ sagaName: definition.name })).resolves.toHaveLength(1);
  });

  it("records input resolver failures as failed step state before compensation", async () => {
    const events: string[] = [];
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "resolver-failure",
      steps: [
        {
          id: "reserve-payment",
          run: () => {
            events.push("reserve-payment");
            return { paymentId: "pay_123" };
          },
          compensate: () => {
            events.push("refund-payment");
            return { refunded: true };
          },
        },
        {
          id: "derive-seat-input",
          input: () => {
            throw new ProviderProblem("seat input could not be derived");
          },
          run: () => ({ unreachable: true }),
        },
      ],
    };

    await expect(runner.execute(definition, { orderId: "ord_123" })).rejects.toThrow(
      SagaExecutionFailedProblem,
    );

    const [execution] = await runner.listExecutions({ sagaName: definition.name });

    expect(events).toEqual(["reserve-payment", "refund-payment"]);
    expect(execution.status).toBe("compensated");
    expect(execution.steps).toEqual([
      expect.objectContaining({
        id: "reserve-payment",
        status: "compensated",
      }),
      expect.objectContaining({
        id: "derive-seat-input",
        status: "failed",
        attempts: 0,
        input: undefined,
        error: expect.objectContaining({
          message: "seat input could not be derived",
        }),
      }),
    ]);
  });

  it("emits telemetry spans for saga steps and compensation steps", async () => {
    const spanNames: string[] = [];
    vi.spyOn(trace, "getTracer").mockReturnValue(createMockTracer(spanNames, createMockSpan()));

    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "telemetry-saga",
      steps: [
        {
          id: "reserve-payment",
          run: () => ({ paymentId: "pay_123" }),
          compensate: () => ({ refunded: true }),
        },
        {
          id: "fail-after-payment",
          run: () => {
            throw new ProviderProblem("provider unavailable");
          },
        },
      ],
    };

    await expect(runner.execute(definition, { orderId: "ord_123" })).rejects.toThrow(
      SagaExecutionFailedProblem,
    );

    expect(spanNames).toEqual(
      expect.arrayContaining([
        "saga:telemetry-saga",
        "saga:telemetry-saga:step:reserve-payment",
        "saga:telemetry-saga:step:fail-after-payment",
        "saga:telemetry-saga:compensate:reserve-payment",
      ]),
    );
  });

  it("rejects invalid saga definitions before creating execution state", async () => {
    const runner = new SagaRunner();
    const definition: SagaDefinition = {
      name: "invalid-saga",
      steps: [
        {
          id: "duplicate",
          run: () => undefined,
        },
        {
          id: "duplicate",
          run: () => undefined,
        },
      ],
    };

    await expect(runner.execute(definition, {})).rejects.toThrow(SagaDefinitionProblem);
    await expect(runner.listExecutions()).resolves.toEqual([]);
  });
});
