import { OutboundWebhookConfigurationProblem } from "./OutboundWebhookProblems";
import type {
  OutboundWebhookAttempt,
  OutboundWebhookEndpoint,
  OutboundWebhookEvent,
  OutboundWebhookStore,
} from "./types";

export type OutboundWebhookStoreConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type OutboundWebhookStoreConformanceOptions = {
  readonly createStore: () => OutboundWebhookStore | Promise<OutboundWebhookStore>;
  readonly reopenStore?: (
    store: OutboundWebhookStore,
  ) => OutboundWebhookStore | Promise<OutboundWebhookStore>;
  readonly event: OutboundWebhookEvent;
  readonly endpoint: OutboundWebhookEndpoint;
};

export type OutboundWebhookStoreConformanceSuite = {
  readonly cases: readonly OutboundWebhookStoreConformanceCase[];
};

export function createOutboundWebhookStoreConformanceSuite(
  options: OutboundWebhookStoreConformanceOptions,
): OutboundWebhookStoreConformanceSuite {
  return {
    cases: [
      {
        name: "atomically persists an immutable event, endpoint delivery, and dispatch intent",
        run: async () => {
          const store = await options.createStore();
          const result = await store.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          assert(
            result.deliveries.length === 1,
            "one subscribed endpoint must create one delivery",
          );
          assert(
            result.intents.length === 1,
            "one active delivery must create one dispatch intent",
          );
          const reopened =
            options.reopenStore === undefined ? store : await options.reopenStore(store);
          assert(
            (await reopened.getEvent(options.event.tenantId, options.event.id)) !== undefined,
            "event must survive store reopen",
          );
          assert(
            (await reopened.getDelivery(options.event.tenantId, result.deliveries[0]?.id ?? "")) !==
              undefined,
            "delivery must survive store reopen",
          );
        },
      },
      {
        name: "deduplicates event and endpoint delivery by immutable logical identity",
        run: async () => {
          const store = await options.createStore();
          const first = await store.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          const duplicate = await store.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          assert(!first.duplicate, "first commit must not be a duplicate");
          assert(duplicate.duplicate, "repeated commit must be a duplicate");
          assert(
            (await store.listDeliveries(options.event.tenantId, options.event.id)).length === 1,
            "repeated commit must not create a second endpoint delivery",
          );
        },
      },
      {
        name: "preserves attempt ordering and exact event payload bytes",
        run: async () => {
          const store = await options.createStore();
          const committed = await store.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          const delivery = committed.deliveries[0];
          assert(delivery !== undefined, "delivery must exist");
          const attempt: OutboundWebhookAttempt = {
            id: "attempt-conformance",
            deliveryId: delivery?.id ?? "",
            number: 1,
            secretVersion: options.endpoint.activeSecretVersion,
            signature: "v1=fixture",
            timestamp: "0",
            startedAt: options.event.committedAt,
            completedAt: options.event.committedAt,
            outcome: { kind: "http", status: 204 },
            classification: "delivered",
          };
          await store.recordAttempt({
            tenantId: options.event.tenantId,
            attempt,
            status: "delivered",
          });
          const persisted = await store.getEvent(options.event.tenantId, options.event.id);
          assert(
            bytesEqual(persisted?.payloadBytes, options.event.payloadBytes),
            "attempt recording must not mutate immutable payload bytes",
          );
          assert(
            (await store.listAttempts(options.event.tenantId, delivery?.id ?? ""))
              .map((item) => item.number)
              .join(",") === "1",
            "attempt evidence must remain ordered",
          );
        },
      },
      {
        name: "keeps retry schedules consistent across retrying and terminal transitions",
        run: async () => {
          const invalidStore = await options.createStore();
          const invalidCommit = await invalidStore.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          const invalidDelivery = invalidCommit.deliveries[0];
          assert(invalidDelivery !== undefined, "delivery must exist");

          await assertRejectsConfigurationProblem(
            () =>
              invalidStore.recordAttempt({
                tenantId: options.event.tenantId,
                attempt: createAttempt(invalidDelivery.id, 1, options, "retryable"),
                status: "retrying",
              }),
            "retrying transition without a schedule must fail",
          );
          await assertRejectsConfigurationProblem(
            () =>
              invalidStore.recordAttempt({
                tenantId: options.event.tenantId,
                attempt: createAttempt(invalidDelivery.id, 1, options, "retryable"),
                status: "retrying",
                nextAttemptAt: new Date(Number.NaN),
              }),
            "retrying transition with an invalid schedule must fail",
          );
          await assertRejectsConfigurationProblem(
            () =>
              invalidStore.recordAttempt({
                tenantId: options.event.tenantId,
                attempt: createAttempt(invalidDelivery.id, 1, options, "retryable"),
                status: "retrying",
                nextAttemptAt: options.event.committedAt,
              }),
            "retrying transition before attempt completion must fail",
          );
          assert(
            (await invalidStore.listAttempts(options.event.tenantId, invalidDelivery.id)).length ===
              0,
            "invalid retry schedules must not record attempt evidence",
          );

          for (const status of ["delivered", "dead"] as const) {
            const store = await options.createStore();
            const committed = await store.commitEvent({
              event: options.event,
              endpoints: [options.endpoint],
            });
            const delivery = committed.deliveries[0];
            assert(delivery !== undefined, "delivery must exist");
            const nextAttemptAt = new Date(options.event.committedAt.getTime() + 1_000);
            const retrying = await store.recordAttempt({
              tenantId: options.event.tenantId,
              attempt: createAttempt(delivery.id, 1, options, "retryable"),
              status: "retrying",
              nextAttemptAt,
            });
            assert(
              retrying.nextAttemptAt?.getTime() === nextAttemptAt.getTime(),
              "retrying transition must preserve its schedule",
            );

            const terminal = await store.recordAttempt({
              tenantId: options.event.tenantId,
              attempt: createAttempt(
                delivery.id,
                2,
                options,
                status === "delivered" ? "delivered" : "permanent",
              ),
              status,
            });
            assert(
              terminal.nextAttemptAt === undefined,
              `${status} transition must clear the earlier retry schedule`,
            );
            assert(
              (await store.listAttempts(options.event.tenantId, delivery.id))
                .map((attempt) => attempt.number)
                .join(",") === "1,2",
              "terminal transition must preserve ordered attempt history",
            );
          }
        },
      },
      {
        name: "gives each replay a fresh retry budget and dispatch identity",
        run: async () => {
          const store = await options.createStore();
          const committed = await store.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          const delivery = committed.deliveries[0];
          const initialIntent = committed.intents[0];
          assert(delivery !== undefined, "delivery must exist");
          assert(initialIntent !== undefined, "initial dispatch intent must exist");
          await store.markIntentPublished(
            options.event.tenantId,
            initialIntent.id,
            options.event.committedAt,
          );

          const firstRetryAt = new Date(options.event.committedAt.getTime() + 2);
          await store.recordAttempt({
            tenantId: options.event.tenantId,
            attempt: createAttempt(delivery.id, 1, options, "retryable"),
            status: "retrying",
            nextAttemptAt: firstRetryAt,
          });
          const originalRetryIntent = (
            await store.listUnpublishedIntents(options.event.tenantId)
          )[0];
          assert(originalRetryIntent !== undefined, "original retry intent must exist");
          await store.markIntentPublished(
            options.event.tenantId,
            originalRetryIntent.id,
            firstRetryAt,
          );
          await store.recordAttempt({
            tenantId: options.event.tenantId,
            attempt: createAttempt(delivery.id, 2, options, "permanent"),
            status: "dead",
          });

          const replay = await store.createReplay({
            tenantId: options.event.tenantId,
            deliveryId: delivery.id,
            replayId: "replay-conformance",
            createdAt: new Date(options.event.committedAt.getTime() + 3),
          });
          assert(
            replay.status === "pending" && replay.attemptCount === 0,
            "replay must start pending with a fresh retry budget",
          );
          assert(
            (await store.listAttempts(options.event.tenantId, delivery.id))
              .map((attempt) => attempt.number)
              .join(",") === "1,2",
            "replay must preserve original attempt evidence",
          );
          const replayIntent = (await store.listUnpublishedIntents(options.event.tenantId))[0];
          assert(replayIntent !== undefined, "replay dispatch intent must exist");
          await store.markIntentPublished(
            options.event.tenantId,
            replayIntent.id,
            replay.updatedAt,
          );

          const replayRetryAt = new Date(options.event.committedAt.getTime() + 5);
          const retryingReplay = await store.recordAttempt({
            tenantId: options.event.tenantId,
            attempt: {
              ...createAttempt(delivery.id, 1, options, "retryable"),
              id: "attempt-conformance-replay-1",
              completedAt: new Date(options.event.committedAt.getTime() + 4),
            },
            status: "retrying",
            nextAttemptAt: replayRetryAt,
          });
          const replayRetryIntent = (await store.listUnpublishedIntents(options.event.tenantId))[0];
          assert(replayRetryIntent !== undefined, "replay retry intent must exist");
          assert(
            replayRetryIntent.idempotencyKey !== originalRetryIntent.idempotencyKey,
            "replay retry intent must not collide with the original retry cycle",
          );
          assert(
            retryingReplay.status === "retrying" && retryingReplay.attemptCount === 1,
            "first replay attempt must retain one remaining retry",
          );

          const deadReplay = await store.recordAttempt({
            tenantId: options.event.tenantId,
            attempt: {
              ...createAttempt(delivery.id, 2, options, "permanent"),
              id: "attempt-conformance-replay-2",
              completedAt: new Date(options.event.committedAt.getTime() + 6),
            },
            status: "dead",
          });
          assert(
            deadReplay.attemptCount === 2,
            "replay must consume the same complete retry budget as an original delivery",
          );
          assert(
            (await store.listAttempts(options.event.tenantId, delivery.id))
              .map((attempt) => attempt.number)
              .join(",") === "1,2,1,2",
            "replay must append its attempts without removing original evidence",
          );
        },
      },
      {
        name: "marks each intent publication exactly once under concurrency",
        run: async () => {
          const store = await options.createStore();
          const committed = await store.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          const intent = committed.intents[0];
          assert(intent !== undefined, "one unpublished intent must exist");
          const transitions = await Promise.all([
            store.markIntentPublished(options.event.tenantId, intent.id, options.event.committedAt),
            store.markIntentPublished(options.event.tenantId, intent.id, options.event.committedAt),
          ]);
          assert(
            transitions.filter(Boolean).length === 1,
            "only one concurrent publication mark may transition the intent",
          );
        },
      },
      {
        name: "claims an eligible delivery only once under concurrency",
        run: async () => {
          const store = await options.createStore();
          const committed = await store.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          const deliveryId = committed.deliveries[0]?.id ?? "";
          const claims = await Promise.all([
            store.claimDelivery(options.event.tenantId, deliveryId, options.event.committedAt),
            store.claimDelivery(options.event.tenantId, deliveryId, options.event.committedAt),
          ]);
          assert(
            claims.filter((claim) => claim !== undefined).length === 1,
            "only one concurrent claim may succeed",
          );
          await store.releaseDeliveryClaim(options.event.tenantId, deliveryId);
        },
      },
    ],
  };
}

function createAttempt(
  deliveryId: string,
  number: number,
  options: OutboundWebhookStoreConformanceOptions,
  classification: OutboundWebhookAttempt["classification"],
): OutboundWebhookAttempt {
  return {
    id: `attempt-conformance-${number}`,
    deliveryId,
    number,
    secretVersion: options.endpoint.activeSecretVersion,
    signature: "v1=fixture",
    timestamp: String(number),
    startedAt: options.event.committedAt,
    completedAt: new Date(options.event.committedAt.getTime() + number),
    outcome: { kind: "http", status: classification === "delivered" ? 204 : 500 },
    classification,
  };
}

async function assertRejectsConfigurationProblem(
  operation: () => Promise<unknown>,
  message: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof OutboundWebhookConfigurationProblem, message);
    return;
  }
  throw new OutboundWebhookConfigurationProblem(`store conformance failed: ${message}`);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new OutboundWebhookConfigurationProblem(`store conformance failed: ${message}`);
  }
}

function bytesEqual(left: Uint8Array | undefined, right: Uint8Array): boolean {
  return left !== undefined && Buffer.from(left).equals(Buffer.from(right));
}
