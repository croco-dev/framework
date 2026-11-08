import { describe, expect, it } from "vitest";
import { InMemorySagaStore, SagaDefinitionProblem, SagaListPaginationProblem } from "../index";
import type { ListSagaExecutionsOptions, SagaExecution, SagaStepExecutionRecord } from "../index";

type PaginationField = "limit" | "offset";

const INVALID_PAGINATION_VALUES: ReadonlyArray<{
  readonly field: PaginationField;
  readonly value: number;
}> = [
  { field: "offset", value: -1 },
  { field: "offset", value: 0.5 },
  { field: "offset", value: Number.NaN },
  { field: "offset", value: Number.POSITIVE_INFINITY },
  { field: "offset", value: Number.NEGATIVE_INFINITY },
  { field: "limit", value: 0 },
  { field: "limit", value: -1 },
  { field: "limit", value: 0.5 },
  { field: "limit", value: Number.NaN },
  { field: "limit", value: Number.POSITIVE_INFINITY },
  { field: "limit", value: Number.NEGATIVE_INFINITY },
];

describe("InMemorySagaStore", () => {
  it("detaches create input, its returned record and the injected clock value", async () => {
    const now = new Date("2026-10-20T01:02:03Z");
    const payload = { order: { quantity: 2 } };
    const metadata = { audit: { actor: "original" } };
    const store = new InMemorySagaStore(() => now);
    const created = await store.create({ sagaName: "checkout", payload, metadata });
    payload.order.quantity = 90;
    metadata.audit.actor = "changed";
    now.setUTCFullYear(2030);
    Reflect.set(created, "status", "completed");
    (created.payload as typeof payload).order.quantity = 91;
    (created.metadata as typeof metadata).audit.actor = "returned";
    created.createdAt.setUTCFullYear(2031);
    await expect(store.findById(created.id)).resolves.toMatchObject({
      status: "pending",
      payload: { order: { quantity: 2 } },
      metadata: { audit: { actor: "original" } },
      createdAt: new Date("2026-10-20T01:02:03Z"),
    });
    expect(Object.isFrozen(payload.order)).toBe(false);
  });

  function completedData() {
    const step = {
      id: "charge",
      status: "completed",
      attempts: 1,
      maxAttempts: 1,
      input: { quantity: 2 },
      result: { payment: { id: "pay-original" } },
      compensationResult: { refunded: { amount: 37 } },
      outboxMessages: [
        {
          id: "charged",
          topic: "billing.charged",
          payload: { amount: 37 },
          metadata: { audit: { actor: "original" } },
          deliveryId: "delivery-original",
          stepId: "charge",
          phase: "step",
          status: "pending",
          enqueuedAt: "2026-10-20T01:02:03Z",
        },
      ],
      completedAt: new Date("2026-10-20T01:02:04Z"),
    } satisfies SagaStepExecutionRecord;
    return {
      status: "completed" as const,
      result: { receipt: { id: "receipt-original" } },
      steps: [step],
      compensationFailures: [{ message: "original", retryable: false }],
      completedAt: new Date("2026-10-20T01:02:05Z"),
    };
  }

  function corruptCompleted(execution: SagaExecution) {
    const data = execution as unknown as ReturnType<typeof completedData>;
    Reflect.set(execution, "status", "running");
    data.result.receipt.id = "changed";
    data.steps[0].input.quantity = 99;
    data.steps[0].result.payment.id = "changed";
    data.steps[0].compensationResult.refunded.amount = 99;
    data.steps[0].outboxMessages[0].payload.amount = 99;
    data.steps[0].outboxMessages[0].metadata.audit.actor = "changed";
    data.steps[0].outboxMessages[0].deliveryId = "changed";
    data.steps[0].completedAt.setUTCFullYear(2030);
    data.compensationFailures[0].message = "changed";
    data.completedAt.setUTCFullYear(2030);
  }

  it("detaches update input before retaining nested steps, results and outbox messages", async () => {
    const store = new InMemorySagaStore();
    const created = await store.create({ sagaName: "checkout", payload: {} });
    const data = completedData();
    const expected = completedData();
    await store.update(created.id, data);
    corruptCompleted({ ...created, ...data });
    data.steps.push({ ...data.steps[0], id: "extra" });
    await expect(store.findById(created.id)).resolves.toMatchObject(expected);
    expect(Object.isFrozen(data.steps[0].result.payment)).toBe(false);
  });

  it.each(["update", "findById", "findByIdempotencyKey", "list", "duplicate create"] as const)(
    "detaches the entire %s result from stored execution evidence",
    async (boundary) => {
      const store = new InMemorySagaStore();
      const created = await store.create({
        sagaName: "checkout",
        payload: { order: { quantity: 2 } },
        metadata: { audit: { actor: "original" } },
        idempotencyKey: "order-123",
      });
      const updated = await store.update(created.id, completedData());
      let view: SagaExecution | null | undefined;
      switch (boundary) {
        case "update":
          view = updated;
          break;
        case "findById":
          view = await store.findById(created.id);
          break;
        case "findByIdempotencyKey":
          view = await store.findByIdempotencyKey("checkout", "order-123");
          break;
        case "list":
          [view] = await store.list({ status: "completed" });
          break;
        case "duplicate create":
          view = await store.create({
            sagaName: "checkout",
            payload: {},
            idempotencyKey: "order-123",
          });
          break;
      }
      expect(view).toBeDefined();
      if (!view) throw new Error("Expected a stored execution");
      corruptCompleted(view);
      (view.payload as { order: { quantity: number } }).order.quantity = 99;
      (view.metadata as { audit: { actor: string } }).audit.actor = "changed";
      await expect(store.findById(created.id)).resolves.toMatchObject({
        ...completedData(),
        payload: { order: { quantity: 2 } },
        metadata: { audit: { actor: "original" } },
      });
      await expect(store.list({ status: "completed" })).resolves.toHaveLength(1);
    },
  );

  it("preserves plain value graphs, dates, array holes and own prototype-named properties", async () => {
    const value = Object.assign(Object.create(null) as Record<string, unknown>, {
      count: BigInt(7),
    });
    const array = Object.assign(Array<unknown>(3), { 1: value, label: "items" });
    const payload = {
      value,
      array,
      missing: undefined,
      negativeZero: -0,
      infinity: Infinity,
      when: new Date("2026-10-20T01:02:03Z"),
      nan: NaN,
      self: null as unknown,
    };
    payload.self = payload;
    Object.defineProperty(payload, "__proto__", { enumerable: true, value: { safe: true } });
    const store = new InMemorySagaStore();
    const created = await store.create({ sagaName: "values", payload });
    const saved = created.payload as typeof payload;
    expect(saved).toEqual(payload);
    expect(saved).not.toBe(payload);
    expect(saved.self).toBe(saved);
    expect(saved.array[1]).toBe(saved.value);
    expect(Object.getPrototypeOf(saved.value)).toBeNull();
    expect(Object.hasOwn(saved.array, 0)).toBe(false);
    expect(Object.hasOwn(saved, "missing")).toBe(true);
    expect(Object.hasOwn(saved, "__proto__")).toBe(true);
    expect(Object.is(saved.negativeZero, -0)).toBe(true);
    saved.when.setUTCFullYear(2030);
    saved.value.count = BigInt(99);
    const queried = await store.findById(created.id);
    expect((queried?.payload as typeof payload).when).toEqual(new Date("2026-10-20T01:02:03Z"));
    expect((queried?.payload as typeof payload).value.count).toBe(BigInt(7));
  });

  it("preserves a caller-owned Date property named getTime without using it as a method", async () => {
    const when = new Date("2026-10-20T01:02:03Z");
    Object.defineProperty(when, "getTime", { enumerable: true, value: 17 });
    const store = new InMemorySagaStore();
    const created = await store.create({ sagaName: "checkout", payload: { when } });
    const queried = await store.findById(created.id);
    const saved = (queried?.payload as { when: Date }).when;
    expect(Date.prototype.getTime.call(saved)).toBe(Date.UTC(2026, 9, 20, 1, 2, 3));
    expect(Reflect.get(saved, "getTime")).toBe(17);
    expect(saved).not.toBe(when);
  });

  it.each(["create", "update"] as const)(
    "rejects unsupported caller-owned Date accessors before %s changes stored state",
    async (boundary) => {
      const store = new InMemorySagaStore();
      const existing =
        boundary === "update"
          ? await store.create({ sagaName: "checkout", payload: { original: true } })
          : undefined;
      const when = new Date("2026-10-20T01:02:03Z");
      let reads = 0;
      Object.defineProperty(when, "getTime", {
        enumerable: true,
        get() {
          reads += 1;
          return reads <= 2 ? Date.prototype.getTime : 0;
        },
      });
      const operation = existing
        ? store.update(existing.id, { status: "completed", result: { when } })
        : store.create({ sagaName: "checkout", payload: { when } });
      await expect(operation).rejects.toMatchObject({
        code: "workflow-core/saga-definition-invalid",
      });
      await expect(store.list()).resolves.toEqual(existing ? [existing] : []);
      expect(reads).toBe(1);
    },
  );

  it("rejects an invalid caller-owned Date even when getTime reports a valid timestamp", async () => {
    const when = new Date(NaN);
    Object.defineProperty(when, "getTime", { value: () => Date.UTC(2026, 9, 20) });
    const store = new InMemorySagaStore();
    await expect(store.create({ sagaName: "checkout", payload: { when } })).rejects.toMatchObject({
      code: "workflow-core/saga-definition-invalid",
    });
    await expect(store.list()).resolves.toEqual([]);
  });

  it.each([
    { nested: () => undefined },
    { nested: Symbol("unsupported") },
    { nested: new Map([["key", 1]]) },
    { nested: new Set([1]) },
    { nested: new Uint8Array([1]) },
    { nested: new Date(NaN) },
    { [Symbol("key")]: "unsupported" },
    {
      nested: new (class Value {
        count = 1;
      })(),
    },
  ])("rejects unsupported input without retaining a partial write: %o", async (unsupported) => {
    const store = new InMemorySagaStore();
    await expect(store.create({ sagaName: "checkout", payload: unsupported })).rejects.toThrow(
      SagaDefinitionProblem,
    );
    await expect(store.list()).resolves.toEqual([]);
    const created = await store.create({ sagaName: "checkout", payload: { quantity: 2 } });
    await expect(
      store.update(created.id, { status: "completed", result: unsupported }),
    ).rejects.toMatchObject({
      code: "workflow-core/saga-definition-invalid",
      extensions: { retryable: false },
    });
    await expect(store.findById(created.id)).resolves.toEqual(created);
  });

  it("captures accessors once without freezing inputs and rejects unreadable values atomically", async () => {
    let reads = 0;
    const payload = Object.freeze({
      get quantity() {
        reads += 1;
        return { value: reads };
      },
    });
    const store = new InMemorySagaStore();
    const created = await store.create({ sagaName: "checkout", payload });
    expect(reads).toBe(1);
    expect(created.payload).toEqual({ quantity: { value: 1 } });
    const unreadable = {
      get value(): unknown {
        throw new Error("unreadable");
      },
    };
    await expect(store.update(created.id, { result: unreadable })).rejects.toMatchObject({
      code: "workflow-core/saga-definition-invalid",
      extensions: { retryable: false },
    });
    await expect(store.findById(created.id)).resolves.toEqual(created);
    expect(reads).toBe(1);
  });

  it("persists request identity and returns the winning create record intact", async () => {
    const store = new InMemorySagaStore();
    const first = await store.create({
      sagaName: "checkout",
      idempotencyKey: "order-123",
      payload: { quantity: 1 },
      requestFingerprint: "saga-request:v1:first",
    });
    const duplicate = await store.create({
      sagaName: "checkout",
      idempotencyKey: "order-123",
      payload: { quantity: 99 },
      requestFingerprint: "saga-request:v1:second",
    });
    expect(duplicate).toEqual(first);
    expect((await store.findByIdempotencyKey("checkout", "order-123"))?.requestFingerprint).toBe(
      "saga-request:v1:first",
    );
  });

  it.each(INVALID_PAGINATION_VALUES)(
    "rejects invalid $field value $value with a stable pagination Problem",
    async ({ field, value }) => {
      const store = new InMemorySagaStore();
      const options = { [field]: value } as ListSagaExecutionsOptions;
      const result = store.list(options);

      await expect(result).rejects.toThrow(SagaListPaginationProblem);
      await expect(result).rejects.toMatchObject({
        code: "workflow-core/saga-list-pagination-invalid",
        extensions: {
          field,
          receivedValue: String(value),
          retryable: false,
        },
      });
    },
  );

  it("keeps insertion ordering and applies valid offset and limit bounds", async () => {
    const store = new InMemorySagaStore();
    await store.create({ sagaName: "checkout", payload: "first" });
    await store.create({ sagaName: "checkout", payload: "second" });
    await store.create({ sagaName: "checkout", payload: "third" });

    await expect(store.list({ offset: 0, limit: 2 })).resolves.toMatchObject([
      { payload: "first" },
      { payload: "second" },
    ]);
    await expect(store.list({ offset: 1, limit: 2 })).resolves.toMatchObject([
      { payload: "second" },
      { payload: "third" },
    ]);
    await expect(store.list({ offset: 3, limit: 2 })).resolves.toEqual([]);
  });
});
