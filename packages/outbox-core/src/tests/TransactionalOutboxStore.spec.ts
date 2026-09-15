import { describe, expect, it } from "vitest";
import {
  createTransactionalOutboxStoreContractSuite,
  InMemoryTransactionalOutboxStore,
  OUTBOX_DISPATCH_PROBLEM_CODE,
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

  it("snapshots claim options before queued execution", async () => {
    const store = new InMemoryTransactionalOutboxStore();
    const unitOfWorkReady = createDeferred<void>();
    const releaseUnitOfWork = createDeferred<void>();
    const now = new Date("2026-01-01T00:00:00.000Z");
    await store.record(createIntent("claim-options-snapshot"), {
      id: "claim-options-snapshot",
      now,
    });

    const unitOfWork = store.runInUnitOfWork(async () => {
      unitOfWorkReady.resolve(undefined);
      await releaseUnitOfWork.promise;
    });
    await unitOfWorkReady.promise;

    const claimOptions = {
      limit: 1,
      now,
      visibilityTimeoutMs: 1_000,
      dispatcherId: "dispatcher-a",
    };
    const claim = store.claimBatch(claimOptions);
    claimOptions.visibilityTimeoutMs = 0;
    claimOptions.dispatcherId = "dispatcher-b";
    now.setTime(Date.parse("2026-01-02T00:00:00.000Z"));
    releaseUnitOfWork.resolve(undefined);

    const [claimed] = await claim;
    await unitOfWork;

    expect(claimed.claim).toMatchObject({
      dispatcherId: "dispatcher-a",
      claimedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-01T00:00:01.000Z"),
    });
  });

  it("terminally fails an expired claim after its retry budget is exhausted", async () => {
    const store = new InMemoryTransactionalOutboxStore();
    const now = new Date("2026-01-01T00:00:00.000Z");
    await store.record(createIntent("expired-exhausted-claim"), {
      id: "expired-exhausted-claim",
      now,
      retry: { maxAttempts: 1 },
    });

    await store.claimBatch({
      limit: 1,
      now,
      visibilityTimeoutMs: 1_000,
    });

    await expect(
      store.claimBatch({
        limit: 1,
        now: new Date("2026-01-01T00:00:01.000Z"),
        visibilityTimeoutMs: 1_000,
      }),
    ).resolves.toEqual([]);
    await expect(store.findRecord("expired-exhausted-claim")).resolves.toMatchObject({
      status: "failed",
      retry: {
        attempt: 1,
        maxAttempts: 1,
        terminal: true,
      },
      claim: undefined,
      failure: {
        problem: {
          code: OUTBOX_DISPATCH_PROBLEM_CODE,
          outboxAttempt: 1,
          outboxMaxAttempts: 1,
          outboxTerminal: true,
        },
        retry: {
          attempt: 1,
          maxAttempts: 1,
          terminal: true,
        },
      },
    });
  });

  it("claims healthy work after terminally failing an older expired claim", async () => {
    const store = new InMemoryTransactionalOutboxStore();
    const now = new Date("2026-01-01T00:00:00.000Z");
    await store.record(createIntent("expired-exhausted-claim"), {
      id: "expired-exhausted-claim",
      now,
      retry: { maxAttempts: 1 },
    });
    await store.record(createIntent("healthy-pending-claim"), {
      id: "healthy-pending-claim",
      now,
    });

    const [first] = await store.claimBatch({
      limit: 1,
      now,
      visibilityTimeoutMs: 1_000,
    });
    expect(first.id).toBe("expired-exhausted-claim");

    const [next] = await store.claimBatch({
      limit: 1,
      now: new Date("2026-01-01T00:00:01.000Z"),
      visibilityTimeoutMs: 1_000,
    });

    expect(next.id).toBe("healthy-pending-claim");
    await expect(store.findRecord("expired-exhausted-claim")).resolves.toMatchObject({
      status: "failed",
      retry: { attempt: 1, terminal: true },
    });
  });

  it("delays retryable failures when the dispatcher omits nextVisibleAt", async () => {
    const store = new InMemoryTransactionalOutboxStore();
    const now = new Date("2026-01-01T00:00:00.000Z");
    await store.record(createIntent("default-retry-delay"), {
      id: "default-retry-delay",
      now,
    });
    const [claimed] = await store.claimBatch({
      limit: 1,
      now,
      visibilityTimeoutMs: 1_000,
    });
    const failedAt = new Date("2026-01-01T00:00:00.100Z");
    const nextVisibleAt = new Date("2026-01-01T00:00:01.100Z");

    await store.markFailed(
      claimed.id,
      new OutboxDispatchProblem({
        detail: "Provider temporarily rejected payload.",
        failure: {
          retryable: true,
          terminal: false,
          attempt: claimed.claim.attempt,
          maxAttempts: claimed.retry.maxAttempts,
          failedAt,
        },
      }),
    );

    const [record] = await store.listRecords();
    expect(record).toMatchObject({
      status: "retrying",
      availableAt: nextVisibleAt,
      failure: {
        problem: {
          outboxNextVisibleAt: nextVisibleAt.toISOString(),
        },
        retry: {
          nextVisibleAt,
        },
      },
      retry: {
        nextVisibleAt,
      },
    });
    await expect(
      store.claimBatch({
        limit: 1,
        now: failedAt,
        visibilityTimeoutMs: 1_000,
      }),
    ).resolves.toEqual([]);
    await expect(
      store.claimBatch({
        limit: 1,
        now: nextVisibleAt,
        visibilityTimeoutMs: 1_000,
      }),
    ).resolves.toMatchObject([{ id: "default-retry-delay", status: "claimed" }]);
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
