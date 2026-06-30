import { describe, expect, it } from "vitest";
import {
  createTransactionalOutboxStoreContractSuite,
  InMemoryTransactionalOutboxStore,
  OutboxDispatchProblem,
  OutboxUnitOfWorkContextProblem,
} from "../index";
import { createDeferred } from "../libs/conformance";

describe("TransactionalOutboxStore contract", () => {
  const suite = createTransactionalOutboxStoreContractSuite({
    createStore: () => new InMemoryTransactionalOutboxStore(),
    listRecords: (store) => store.listRecords(),
    runInUnitOfWork: (store, fn) => store.runInUnitOfWork(fn),
  });

  it.each(suite.cases)("$name", async (testCase) => {
    await testCase.run();
  });

  it("serializes clear after an in-flight Unit of Work commit", async () => {
    const store = new InMemoryTransactionalOutboxStore();
    const unitOfWorkReady = createDeferred<void>();
    const releaseUnitOfWork = createDeferred<void>();

    const unitOfWork = store.runInUnitOfWork(async (context) => {
      await store.record(
        {
          type: "email.send",
          tenant: { tenantId: "tenant-a" },
          idempotencyKey: "welcome:user-1",
          source: { eventId: "event-1", eventType: "user.registered" },
          payload: { userId: "user-1" },
        },
        {
          id: "committed-before-clear",
          context,
          now: new Date("2026-01-01T00:00:00.000Z"),
        },
      );
      unitOfWorkReady.resolve(undefined);
      await releaseUnitOfWork.promise;
    });

    await unitOfWorkReady.promise;
    const clear = store.clear();
    releaseUnitOfWork.resolve(undefined);

    await Promise.all([unitOfWork, clear]);

    await expect(store.listRecords()).resolves.toEqual([]);
  });

  it("rejects root mutations started from an active Unit of Work callback", async () => {
    const cases: ReadonlyArray<{
      readonly name: string;
      readonly run: (store: InMemoryTransactionalOutboxStore) => Promise<unknown>;
    }> = [
      {
        name: "nested Unit of Work",
        run: (store) => store.runInUnitOfWork(async () => undefined),
      },
      {
        name: "record without context",
        run: (store) =>
          store.record(createIntent("root-record"), {
            id: "root-record",
            now: new Date("2026-01-01T00:00:00.000Z"),
          }),
      },
      {
        name: "claim without context",
        run: (store) =>
          store.claimBatch({
            limit: 1,
            now: new Date("2026-01-01T00:00:00.000Z"),
            visibilityTimeoutMs: 1_000,
          }),
      },
      {
        name: "mark dispatched",
        run: (store) =>
          store.markDispatched("missing", {
            expectedAttempt: 1,
            dispatchedAt: new Date("2026-01-01T00:00:00.100Z"),
          }),
      },
      {
        name: "mark failed",
        run: (store) =>
          store.markFailed(
            "missing",
            new OutboxDispatchProblem({
              detail: "Provider temporarily rejected payload.",
              failure: {
                retryable: true,
                terminal: false,
                attempt: 1,
                maxAttempts: 3,
                failedAt: new Date("2026-01-01T00:00:00.200Z"),
                nextVisibleAt: new Date("2026-01-01T00:00:05.000Z"),
              },
            }),
          ),
      },
      {
        name: "clear",
        run: (store) => store.clear(),
      },
    ];

    for (const testCase of cases) {
      const store = new InMemoryTransactionalOutboxStore();

      await expect(
        store.runInUnitOfWork(async (context) => {
          await store.record(createIntent(`context-${testCase.name}`), {
            id: `context-${testCase.name}`,
            context,
            now: new Date("2026-01-01T00:00:00.000Z"),
          });
          await testCase.run(store);
        }),
      ).rejects.toThrow(OutboxUnitOfWorkContextProblem);

      await expect(store.listRecords()).resolves.toEqual([]);
    }
  });
});

function createIntent(idempotencyKey: string) {
  return {
    type: "email.send",
    tenant: { tenantId: "tenant-a" },
    idempotencyKey,
    source: { eventId: idempotencyKey, eventType: "user.registered" },
    payload: { userId: idempotencyKey },
  };
}
