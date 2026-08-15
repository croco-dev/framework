import { fail, strictEqual } from "node:assert/strict";
import {
  OUTBOX_CLAIM_CONFIGURATION_PROBLEM_CODE,
  OUTBOX_DISPATCH_PROBLEM_CODE,
  OutboxClaimConfigurationProblem,
  OutboxDispatchProblem,
  OutboxFailureMetadataProblem,
  OutboxRecordIdConflictProblem,
  OutboxUnitOfWorkContextProblem,
} from "./problems/OutboxProblems";
import type {
  OutboxIntent,
  OutboxRecord,
  OutboxTenantBoundary,
  TransactionalOutboxStore,
  TransactionalOutboxStoreContext,
} from "./types";

export type TransactionalOutboxStoreContractCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type TransactionalOutboxStoreContractOptions<
  TStore extends TransactionalOutboxStore<TClient>,
  TClient = unknown,
> = {
  readonly createStore: () => TStore | Promise<TStore>;
  readonly listRecords: (store: TStore) => Promise<readonly OutboxRecord[]>;
  readonly runInUnitOfWork: (
    store: TStore,
    fn: (context: TransactionalOutboxStoreContext<TClient>) => Promise<void>,
  ) => Promise<void>;
};

export type TransactionalOutboxStoreContractSuite = {
  readonly cases: readonly TransactionalOutboxStoreContractCase[];
};

export function createTransactionalOutboxStoreContractSuite<
  TStore extends TransactionalOutboxStore<TClient>,
  TClient = unknown,
>(
  options: TransactionalOutboxStoreContractOptions<TStore, TClient>,
): TransactionalOutboxStoreContractSuite {
  return {
    cases: [
      {
        name: "returns the existing record for duplicate tenant-scoped idempotency keys",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          const first = await store.record(createIntent(), {
            id: "outbox-1",
            now,
          });
          const duplicate = await store.record(createIntent({ payload: { ignored: true } }), {
            id: "outbox-2",
            now,
          });

          assertEqual(duplicate.id, first.id, "duplicate idempotency key must return original");
          assertEqual(
            duplicate.payload.ignored,
            undefined,
            "duplicate idempotency key must not overwrite original payload",
          );
          assertEqual(
            duplicate.source.eventId,
            "event-1",
            "duplicate idempotency key must not overwrite original source metadata",
          );
          assertEqual(
            duplicate.metadata.channel,
            "email",
            "duplicate idempotency key must not overwrite original record metadata",
          );
          assertEqual(
            (await options.listRecords(store)).length,
            1,
            "duplicate idempotency key must not create another record",
          );
        },
      },
      {
        name: "keeps tenant idempotency boundaries isolated",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");

          await store.record(createIntent({ tenant: { tenantId: "tenant-a" } }), { id: "a", now });
          await store.record(createIntent({ tenant: { tenantId: "tenant-b" } }), { id: "b", now });
          await store.record(
            createIntent({
              tenant: { tenantId: "tenant-a", isolationKey: "shard-b" },
            }),
            {
              id: "tenant-a-shard-b",
              now,
            },
          );

          assertEqual(
            (await options.listRecords(store)).length,
            3,
            "same idempotency key must be isolated per tenant and isolation key",
          );
        },
      },
      {
        name: "keeps delimiter-bearing idempotency scopes distinct",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          const collisionVectors = [
            {
              first: { tenantId: "a:b", isolationKey: "c" },
              firstIdempotencyKey: "d",
              second: { tenantId: "a", isolationKey: "b" },
              secondIdempotencyKey: "c:d",
            },
            {
              first: { tenantId: "tenant", isolationKey: "west:blue" },
              firstIdempotencyKey: "welcome",
              second: { tenantId: "tenant:west", isolationKey: "blue" },
              secondIdempotencyKey: "welcome",
            },
          ] as const;

          for (const [index, vector] of collisionVectors.entries()) {
            const first = await store.record(
              createIntent({
                tenant: vector.first,
                idempotencyKey: vector.firstIdempotencyKey,
                payload: { vector: index, side: "first" },
              }),
              { id: `collision-${index}-first`, now },
            );
            const second = await store.record(
              createIntent({
                tenant: vector.second,
                idempotencyKey: vector.secondIdempotencyKey,
                payload: { vector: index, side: "second" },
              }),
              { id: `collision-${index}-second`, now },
            );

            assertEqual(first.id, `collision-${index}-first`, "first scope must create its record");
            assertEqual(
              second.id,
              `collision-${index}-second`,
              "delimiter-bearing scope must create an independent record",
            );
            assertEqual(
              second.payload.side,
              "second",
              "delimiter-bearing scope must preserve its own payload",
            );
          }

          assertEqual(
            (await options.listRecords(store)).length,
            collisionVectors.length * 2,
            "every structured idempotency scope must remain distinct",
          );
        },
      },
      {
        name: "rejects explicit record id reuse across idempotency scopes",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");

          await store.record(createIntent(), { id: "shared-id", now });

          await assertRejects(
            () =>
              store.record(createIntent({ idempotencyKey: "welcome:user-2" }), {
                id: "shared-id",
                now,
              }),
            OutboxRecordIdConflictProblem,
          );

          assertEqual(
            (await options.listRecords(store)).length,
            1,
            "record id conflict must not overwrite the existing record",
          );
        },
      },
      {
        name: "commits records written through a Unit of Work context",
        run: async () => {
          const store = await options.createStore();

          await options.runInUnitOfWork(store, async (context) => {
            await store.record(createIntent(), {
              id: "committed",
              context,
              now: new Date("2026-01-01T00:00:00.000Z"),
            });
          });

          assertEqual(
            (await options.listRecords(store)).length,
            1,
            "committed Unit of Work must persist outbox records",
          );
        },
      },
      {
        name: "commits concurrent Unit of Work writes without losing records",
        run: async () => {
          const store = await options.createStore();

          await Promise.all([
            options.runInUnitOfWork(store, async (context) => {
              await store.record(createIntent(), {
                id: "committed-a",
                context,
                now: new Date("2026-01-01T00:00:00.000Z"),
              });
            }),
            options.runInUnitOfWork(store, async (context) => {
              await store.record(createIntent({ idempotencyKey: "welcome:user-2" }), {
                id: "committed-b",
                context,
                now: new Date("2026-01-01T00:00:00.000Z"),
              });
            }),
          ]);

          assertEqual(
            (await options.listRecords(store)).length,
            2,
            "concurrent Unit of Work commits must preserve independent writes",
          );
        },
      },
      {
        name: "preserves root writes started while a Unit of Work is in flight",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          const tenantB: OutboxTenantBoundary = { tenantId: "tenant-b" };

          await store.record(
            createIntent({
              idempotencyKey: "welcome:dispatch-after-uow",
              tenant: tenantB,
            }),
            { id: "dispatch-after-uow", now },
          );
          await store.record(
            createIntent({
              idempotencyKey: "welcome:failure-after-uow",
              tenant: tenantB,
            }),
            { id: "failure-after-uow", now },
          );

          const unitOfWorkReady = createDeferred<void>();
          const releaseUnitOfWork = createDeferred<void>();
          const unitOfWork = options.runInUnitOfWork(store, async (context) => {
            await store.record(createIntent({ idempotencyKey: "welcome:uow" }), {
              id: "uow",
              context,
              now,
            });
            unitOfWorkReady.resolve(undefined);
            await releaseUnitOfWork.promise;
          });

          await unitOfWorkReady.promise;

          const rootRecord = store.record(createIntent({ idempotencyKey: "welcome:root" }), {
            id: "root",
            now,
          });
          const rootClaimAndComplete = store
            .claimBatch({
              limit: 2,
              now,
              visibilityTimeoutMs: 1_000,
              tenant: tenantB,
            })
            .then(async (claimed) => {
              const claimedById = new Map(claimed.map((record) => [record.id, record]));
              const dispatched = assertDefined(
                claimedById.get("dispatch-after-uow"),
                "dispatch record must be claimed",
              );
              const failed = assertDefined(
                claimedById.get("failure-after-uow"),
                "failure record must be claimed",
              );

              await store.markDispatched(dispatched.id, {
                expectedAttempt: dispatched.claim.attempt,
                dispatchedAt: new Date("2026-01-01T00:00:00.100Z"),
              });
              await store.markFailed(
                failed.id,
                new OutboxDispatchProblem({
                  detail: "Provider temporarily rejected payload.",
                  failure: {
                    retryable: true,
                    terminal: false,
                    attempt: failed.claim.attempt,
                    maxAttempts: failed.retry.maxAttempts,
                    failedAt: new Date("2026-01-01T00:00:00.200Z"),
                    nextVisibleAt: new Date("2026-01-01T00:00:05.000Z"),
                  },
                }),
              );
            });

          releaseUnitOfWork.resolve(undefined);
          await Promise.all([unitOfWork, rootRecord, rootClaimAndComplete]);

          const recordsById = new Map(
            (await options.listRecords(store)).map((record) => [record.id, record]),
          );
          assertEqual(recordsById.get("uow")?.status, "pending", "Unit of Work record must commit");
          assertEqual(
            recordsById.get("root")?.status,
            "pending",
            "root record started during Unit of Work must not be lost",
          );
          assertEqual(
            recordsById.get("dispatch-after-uow")?.status,
            "dispatched",
            "dispatch completion started during Unit of Work must not be lost",
          );
          assertEqual(
            recordsById.get("failure-after-uow")?.status,
            "retrying",
            "failure completion started during Unit of Work must not be lost",
          );
        },
      },
      {
        name: "rolls back records written through a Unit of Work context",
        run: async () => {
          const store = await options.createStore();

          await assertRejects(() =>
            options.runInUnitOfWork(store, async (context) => {
              await store.record(createIntent(), {
                id: "rolled-back",
                context,
                now: new Date("2026-01-01T00:00:00.000Z"),
              });
              throw new Error("rollback");
            }),
          );

          assertEqual(
            (await options.listRecords(store)).length,
            0,
            "rolled back Unit of Work must not persist outbox records",
          );
        },
      },
      {
        name: "rejects malformed Unit of Work contexts",
        run: async () => {
          const store = await options.createStore();
          const malformedContext = {} as TransactionalOutboxStoreContext<TClient>;

          await assertRejects(
            () =>
              store.record(createIntent(), {
                id: "invalid-context",
                context: malformedContext,
                now: new Date("2026-01-01T00:00:00.000Z"),
              }),
            OutboxUnitOfWorkContextProblem,
          );

          assertEqual(
            (await options.listRecords(store)).length,
            0,
            "malformed Unit of Work context must not fall back to non-transactional writes",
          );
        },
      },
      {
        name: "rejects invalid visibility leases before mutating records",
        run: async () => {
          const invalidVisibilityTimeouts = [
            0,
            -1,
            1.5,
            Number.NaN,
            Number.POSITIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
            Number.MAX_SAFE_INTEGER,
            Number.MAX_SAFE_INTEGER + 1,
          ];

          for (const visibilityTimeoutMs of invalidVisibilityTimeouts) {
            const store = await options.createStore();
            const now = new Date("2026-01-01T00:00:00.000Z");
            await store.record(createIntent(), { id: "claimable", now });

            const problem = await assertRejects(
              () =>
                store.claimBatch({
                  limit: 1,
                  now,
                  visibilityTimeoutMs,
                  dispatcherId: "dispatcher-a",
                }),
              OutboxClaimConfigurationProblem,
            );

            assertEqual(
              (problem as OutboxClaimConfigurationProblem).code,
              OUTBOX_CLAIM_CONFIGURATION_PROBLEM_CODE,
              "rejected claim must use the stable configuration Problem code",
            );
            const [record] = await options.listRecords(store);
            assertEqual(record.status, "pending", "rejected claim must preserve record status");
            assertEqual(record.retry.attempt, 0, "rejected claim must preserve attempt count");
          }
        },
      },
      {
        name: "claims one leased record until the visibility timeout expires",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          await store.record(createIntent(), { id: "claimable", now });

          const first = await store.claimBatch({
            limit: 1,
            now,
            visibilityTimeoutMs: 1_000,
            dispatcherId: "dispatcher-a",
          });
          assertEqual(first.length, 1, "first dispatcher must claim the record");

          const blocked = await store.claimBatch({
            limit: 1,
            now: new Date("2026-01-01T00:00:00.999Z"),
            visibilityTimeoutMs: 1_000,
            dispatcherId: "dispatcher-b",
          });
          assertEqual(blocked.length, 0, "leased record must not be claimed concurrently");

          const reclaimed = await store.claimBatch({
            limit: 1,
            now: new Date("2026-01-01T00:00:01.000Z"),
            visibilityTimeoutMs: 1_000,
            dispatcherId: "dispatcher-b",
          });
          assertEqual(reclaimed.length, 1, "expired lease must be claimable");
          assertEqual(reclaimed[0].claim.attempt, 2, "reclaim must increment the attempt");
        },
      },
      {
        name: "claims each record at most once across concurrent dispatchers",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          await store.record(createIntent(), { id: "race", now });

          const [first, second] = await Promise.all([
            store.claimBatch({
              limit: 1,
              now,
              visibilityTimeoutMs: 1_000,
              dispatcherId: "dispatcher-a",
            }),
            store.claimBatch({
              limit: 1,
              now,
              visibilityTimeoutMs: 1_000,
              dispatcherId: "dispatcher-b",
            }),
          ]);

          assertEqual(
            first.length + second.length,
            1,
            "concurrent dispatchers must not claim the same record twice",
          );
        },
      },
      {
        name: "claims records within the requested tenant boundary",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          await store.record(createIntent({ tenant: { tenantId: "tenant-a" } }), {
            id: "tenant-a",
            now,
          });
          await store.record(createIntent({ tenant: { tenantId: "tenant-b" } }), {
            id: "tenant-b",
            now,
          });

          const claimed = await store.claimBatch({
            limit: 10,
            now,
            visibilityTimeoutMs: 1_000,
            tenant: { tenantId: "tenant-a" },
          });

          assertEqual(claimed.length, 1, "claim batch must be scoped to the requested tenant");
          assertEqual(
            claimed[0].tenant.tenantId,
            "tenant-a",
            "claimed record must match requested tenant",
          );
        },
      },
      {
        name: "keeps delimiter-bearing tenant claim boundaries distinct",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          const requestedTenant = { tenantId: "tenant:west", isolationKey: "blue" };
          const collidingTenant = { tenantId: "tenant", isolationKey: "west:blue" };

          await store.record(
            createIntent({ tenant: requestedTenant, idempotencyKey: "requested" }),
            { id: "requested", now },
          );
          await store.record(
            createIntent({ tenant: collidingTenant, idempotencyKey: "colliding" }),
            { id: "colliding", now },
          );

          const claimed = await store.claimBatch({
            limit: 10,
            now,
            visibilityTimeoutMs: 1_000,
            tenant: requestedTenant,
          });

          assertEqual(claimed.length, 1, "claim batch must exclude delimiter-colliding tenants");
          assertEqual(claimed[0].id, "requested", "claim batch must match the structured tenant");
        },
      },
      {
        name: "marks an active claim as dispatched",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          await store.record(createIntent(), { id: "dispatchable", now });
          const [claimed] = await store.claimBatch({
            limit: 1,
            now,
            visibilityTimeoutMs: 1_000,
          });

          await store.markDispatched(claimed.id, {
            expectedAttempt: claimed.claim.attempt,
            dispatchedAt: new Date("2026-01-01T00:00:00.100Z"),
            providerMessageId: "provider-message-1",
          });

          const [record] = await options.listRecords(store);
          assertEqual(record.status, "dispatched", "record must be dispatched");
          assertEqual(
            record.dispatchResult?.providerMessageId,
            "provider-message-1",
            "dispatch metadata must be stored",
          );
        },
      },
      {
        name: "ignores stale claim completion attempts after a record is reclaimed",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          await store.record(createIntent(), { id: "stale", now });
          const [firstClaim] = await store.claimBatch({
            limit: 1,
            now,
            visibilityTimeoutMs: 1_000,
          });
          const [secondClaim] = await store.claimBatch({
            limit: 1,
            now: new Date("2026-01-01T00:00:01.000Z"),
            visibilityTimeoutMs: 1_000,
          });

          await store.markDispatched(firstClaim.id, {
            expectedAttempt: firstClaim.claim.attempt,
            dispatchedAt: new Date("2026-01-01T00:00:01.100Z"),
          });
          await store.markFailed(
            firstClaim.id,
            new OutboxDispatchProblem({
              detail: "Late failure from stale dispatcher.",
              failure: {
                retryable: true,
                terminal: false,
                attempt: firstClaim.claim.attempt,
                maxAttempts: firstClaim.retry.maxAttempts,
                failedAt: new Date("2026-01-01T00:00:01.200Z"),
                nextVisibleAt: new Date("2026-01-01T00:00:05.000Z"),
              },
            }),
          );

          const [record] = await options.listRecords(store);
          assertEqual(
            record.status,
            "claimed",
            "stale completion must not change the reclaimed record",
          );
          assertEqual(
            record.claim?.attempt,
            secondClaim.claim.attempt,
            "record must keep the newer active claim",
          );
        },
      },
      {
        name: "preserves retryable dispatch failure metadata",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          await store.record(createIntent(), {
            id: "retryable",
            now,
            retry: { maxAttempts: 3 },
          });
          const [claimed] = await store.claimBatch({
            limit: 1,
            now,
            visibilityTimeoutMs: 1_000,
          });
          const nextVisibleAt = new Date("2026-01-01T00:00:05.000Z");

          await store.markFailed(
            claimed.id,
            new OutboxDispatchProblem({
              detail: "Broker unavailable.",
              failure: {
                retryable: true,
                terminal: false,
                attempt: claimed.claim.attempt,
                maxAttempts: claimed.retry.maxAttempts,
                failedAt: new Date("2026-01-01T00:00:00.100Z"),
                nextVisibleAt,
              },
            }),
          );

          const [record] = await options.listRecords(store);
          assertEqual(record.status, "retrying", "retryable failure must schedule retry");
          assertEqual(record.retry.retryable, true, "retry metadata must stay retryable");
          assertEqual(
            record.failure?.problem.code,
            OUTBOX_DISPATCH_PROBLEM_CODE,
            "Problem code must be stored",
          );
          assertEqual(
            record.failure?.problem.outboxRetryable,
            true,
            "Problem extensions must expose retryability",
          );
        },
      },
      {
        name: "rejects dispatch failures without outbox retry metadata",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          await store.record(createIntent(), {
            id: "missing-failure-metadata",
            now,
          });
          const [claimed] = await store.claimBatch({
            limit: 1,
            now,
            visibilityTimeoutMs: 1_000,
          });

          await assertRejects(
            () => store.markFailed(claimed.id, new OutboxFailureMetadataProblem()),
            OutboxFailureMetadataProblem,
          );

          const [record] = await options.listRecords(store);
          assertEqual(
            record.status,
            "claimed",
            "invalid failure metadata must not mutate record state",
          );
          assertEqual(
            record.failure?.problem.code,
            undefined,
            "invalid failure metadata must not persist failure details",
          );
        },
      },
      {
        name: "treats retry exhaustion as terminal failure",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          await store.record(createIntent(), {
            id: "exhausted",
            now,
            retry: { maxAttempts: 1 },
          });
          const [claimed] = await store.claimBatch({
            limit: 1,
            now,
            visibilityTimeoutMs: 1_000,
          });

          await store.markFailed(
            claimed.id,
            new OutboxDispatchProblem({
              detail: "Provider rate limit persisted.",
              failure: {
                retryable: true,
                terminal: false,
                attempt: claimed.claim.attempt,
                maxAttempts: claimed.retry.maxAttempts,
                failedAt: new Date("2026-01-01T00:00:00.100Z"),
                nextVisibleAt: new Date("2026-01-01T00:00:05.000Z"),
              },
            }),
          );

          const [record] = await options.listRecords(store);
          assertEqual(record.status, "failed", "exhausted retry budget must stop dispatch");
          assertEqual(record.retry.terminal, true, "retry metadata must mark exhaustion terminal");
          assertEqual(
            record.failure?.problem.outboxTerminal,
            true,
            "stored Problem extensions must expose derived terminal status",
          );
          assertEqual(
            (
              await store.claimBatch({
                limit: 1,
                now: new Date("2026-01-01T00:00:10.000Z"),
                visibilityTimeoutMs: 1_000,
              })
            ).length,
            0,
            "terminal retry exhaustion must not become claimable later",
          );
        },
      },
      {
        name: "uses stored retry budget when dispatch failure metadata disagrees",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          await store.record(createIntent(), {
            id: "stored-retry-budget",
            now,
            retry: { maxAttempts: 1 },
          });
          const [claimed] = await store.claimBatch({
            limit: 1,
            now,
            visibilityTimeoutMs: 1_000,
          });

          await store.markFailed(
            claimed.id,
            new OutboxDispatchProblem({
              detail: "Dispatcher reported a mismatched retry budget.",
              failure: {
                retryable: true,
                terminal: false,
                attempt: claimed.claim.attempt,
                maxAttempts: 10,
                failedAt: new Date("2026-01-01T00:00:00.100Z"),
                nextVisibleAt: new Date("2026-01-01T00:00:05.000Z"),
              },
            }),
          );

          const [record] = await options.listRecords(store);
          assertEqual(
            record.retry.maxAttempts,
            1,
            "stored retry budget must remain the source of truth",
          );
          assertEqual(record.status, "failed", "stored retry budget must control retry exhaustion");
          assertEqual(
            record.failure?.problem.outboxMaxAttempts,
            1,
            "stored Problem extensions must expose the normalized retry budget",
          );
        },
      },
      {
        name: "preserves terminal dispatch failure metadata",
        run: async () => {
          const store = await options.createStore();
          const now = new Date("2026-01-01T00:00:00.000Z");
          await store.record(createIntent(), {
            id: "terminal",
            now,
            retry: { maxAttempts: 1 },
          });
          const [claimed] = await store.claimBatch({
            limit: 1,
            now,
            visibilityTimeoutMs: 1_000,
          });

          await store.markFailed(
            claimed.id,
            new OutboxDispatchProblem({
              detail: "Provider rejected payload.",
              failure: {
                retryable: false,
                terminal: true,
                attempt: claimed.claim.attempt,
                maxAttempts: claimed.retry.maxAttempts,
                failedAt: new Date("2026-01-01T00:00:00.100Z"),
              },
            }),
          );

          const [record] = await options.listRecords(store);
          assertEqual(record.status, "failed", "terminal failure must stop dispatch");
          assertEqual(record.retry.terminal, true, "retry metadata must mark terminal failure");
          assertEqual(
            record.failure?.problem.outboxTerminal,
            true,
            "Problem extensions must expose terminal status",
          );
        },
      },
    ],
  };
}

function createIntent(
  overrides: Partial<OutboxIntent> & {
    readonly tenant?: OutboxTenantBoundary;
  } = {},
): OutboxIntent {
  return {
    type: overrides.type ?? "email.send",
    tenant: overrides.tenant ?? { tenantId: "tenant-a" },
    idempotencyKey: overrides.idempotencyKey ?? "welcome:user-1",
    source: overrides.source ?? {
      eventId: "event-1",
      eventType: "user.registered",
      commandId: "command-1",
      commandType: "user.register",
    },
    payload: overrides.payload ?? { userId: "user-1" },
    traceContext: overrides.traceContext ?? {
      traceId: "trace-1",
      spanId: "span-1",
    },
    metadata: overrides.metadata ?? { channel: "email" },
    occurredAt: overrides.occurredAt ?? new Date("2026-01-01T00:00:00.000Z"),
  };
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  strictEqual(actual, expected, message);
}

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    fail(message);
  }

  return value;
}

export class Deferred<T> {
  readonly promise: Promise<T>;
  resolve!: (value: T | PromiseLike<T>) => void;
  reject!: (reason?: unknown) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export function createDeferred<T>(): Deferred<T> {
  return new Deferred<T>();
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expectedError?: new (...args: never[]) => Error,
): Promise<Error> {
  try {
    await fn();
  } catch (error) {
    if (!(error instanceof Error)) {
      fail(`Expected operation to reject with an Error, got ${typeof error}.`);
    }

    const errorName = error.name;
    if (expectedError && !(error instanceof expectedError)) {
      fail(`Expected operation to reject with ${expectedError.name}, got ${errorName}.`);
    }

    return error;
  }

  fail("Expected operation to reject.");
}
