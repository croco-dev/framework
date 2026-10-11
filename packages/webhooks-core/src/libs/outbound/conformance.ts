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
  readonly advanceStoreTime?: (milliseconds: number) => void | Promise<void>;
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
          await recordClaimedAttempt(store, options, {
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
              recordClaimedAttempt(invalidStore, options, {
                tenantId: options.event.tenantId,
                attempt: createAttempt(invalidDelivery.id, 1, options, "retryable"),
                status: "retrying",
              }),
            "retrying transition without a schedule must fail",
          );
          await assertRejectsConfigurationProblem(
            () =>
              recordClaimedAttempt(invalidStore, options, {
                tenantId: options.event.tenantId,
                attempt: createAttempt(invalidDelivery.id, 1, options, "retryable"),
                status: "retrying",
                nextAttemptAt: new Date(Number.NaN),
              }),
            "retrying transition with an invalid schedule must fail",
          );
          await assertRejectsConfigurationProblem(
            () =>
              recordClaimedAttempt(invalidStore, options, {
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
            const retrying = await recordClaimedAttempt(store, options, {
              tenantId: options.event.tenantId,
              attempt: createAttempt(delivery.id, 1, options, "retryable"),
              status: "retrying",
              nextAttemptAt,
            });
            assert(
              retrying.nextAttemptAt?.getTime() === nextAttemptAt.getTime(),
              "retrying transition must preserve its schedule",
            );

            const terminal = await recordClaimedAttempt(store, options, {
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
        name: "reschedules a due retrying delivery without resetting its attempt history",
        run: async () => {
          const store = await options.createStore();
          const committed = await store.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          const delivery = committed.deliveries[0];
          const initialIntent = committed.intents[0];
          assert(
            delivery !== undefined && initialIntent !== undefined,
            "delivery and intent must exist",
          );
          await store.markIntentPublished(
            options.event.tenantId,
            initialIntent.id,
            options.event.committedAt,
          );

          const nextAttemptAt = new Date(options.event.committedAt.getTime() + 1_000);
          await recordClaimedAttempt(store, options, {
            tenantId: options.event.tenantId,
            attempt: createAttempt(delivery.id, 1, options, "retryable"),
            status: "retrying",
            nextAttemptAt,
          });
          const retryIntent = (await store.listUnpublishedIntents(options.event.tenantId))[0];
          assert(retryIntent !== undefined, "retry intent must exist");
          await store.markIntentPublished(options.event.tenantId, retryIntent.id, nextAttemptAt);

          const scheduledAt = nextAttemptAt;
          const resumed = await store.scheduleDelivery({
            tenantId: options.event.tenantId,
            deliveryId: delivery.id,
            scheduledAt,
          });
          const intents = await store.listUnpublishedIntents(options.event.tenantId);
          assert(intents.length === 1, "due retry must create one new dispatch intent");
          assert(
            intents[0]?.id !== retryIntent.id,
            "resume intent must differ from the consumed retry intent",
          );
          assert(
            intents[0]?.visibleAt.getTime() === scheduledAt.getTime(),
            "resume intent must use the requested time",
          );
          assert(
            intents[0]?.idempotencyKey === `${delivery.id}:resume:${scheduledAt.toISOString()}`,
            "resume intent must use the scheduled time as its identity",
          );
          assert(
            resumed.status === "retrying" &&
              resumed.attemptCount === 1 &&
              resumed.nextAttemptAt?.getTime() === nextAttemptAt.getTime(),
            "resume must preserve the retry state, attempt count, and original schedule",
          );
          await store.scheduleDelivery({
            tenantId: options.event.tenantId,
            deliveryId: delivery.id,
            scheduledAt,
          });
          assert(
            (await store.listUnpublishedIntents(options.event.tenantId)).length === 1,
            "repeated resume at the same time must retain one intent",
          );
          await store.scheduleDelivery({
            tenantId: options.event.tenantId,
            deliveryId: delivery.id,
            scheduledAt: new Date(scheduledAt.getTime() + 1),
          });
          const laterIntents = await store.listUnpublishedIntents(options.event.tenantId);
          assert(
            laterIntents.length === 1 &&
              laterIntents[0]?.id === intents[0]?.id &&
              laterIntents[0]?.idempotencyKey === intents[0]?.idempotencyKey &&
              laterIntents[0]?.visibleAt.getTime() === intents[0]?.visibleAt.getTime(),
            "a later resume must reuse the unpublished resume intent",
          );
        },
      },
      {
        name: "reuses an unpublished retry intent when resuming a due delivery",
        run: async () => {
          const store = await options.createStore();
          const committed = await store.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          const delivery = committed.deliveries[0];
          const initialIntent = committed.intents[0];
          assert(
            delivery !== undefined && initialIntent !== undefined,
            "delivery and intent must exist",
          );
          await store.markIntentPublished(
            options.event.tenantId,
            initialIntent.id,
            options.event.committedAt,
          );

          const nextAttemptAt = new Date(options.event.committedAt.getTime() + 1_000);
          const retrying = await recordClaimedAttempt(store, options, {
            tenantId: options.event.tenantId,
            attempt: createAttempt(delivery.id, 1, options, "retryable"),
            status: "retrying",
            nextAttemptAt,
          });
          const intentsBeforeResume = await store.listUnpublishedIntents(options.event.tenantId);
          assert(intentsBeforeResume.length === 1, "unpublished retry intent must exist");

          const resumed = await store.scheduleDelivery({
            tenantId: options.event.tenantId,
            deliveryId: delivery.id,
            scheduledAt: nextAttemptAt,
          });
          const intentsAfterResume = await store.listUnpublishedIntents(options.event.tenantId);
          assert(
            intentsAfterResume.length === 1 &&
              intentsAfterResume[0]?.id === intentsBeforeResume[0]?.id &&
              intentsAfterResume[0]?.idempotencyKey === intentsBeforeResume[0]?.idempotencyKey &&
              intentsAfterResume[0]?.visibleAt.getTime() ===
                intentsBeforeResume[0]?.visibleAt.getTime(),
            "due resume must reuse the unpublished retry intent",
          );
          assert(
            resumed.status === retrying.status &&
              resumed.attemptCount === retrying.attemptCount &&
              resumed.nextAttemptAt?.getTime() === nextAttemptAt.getTime(),
            "resume must preserve the retry state, attempt count, and original schedule",
          );
        },
      },
      {
        name: "does not reschedule a retrying delivery before its retry time",
        run: async () => {
          const store = await options.createStore();
          const committed = await store.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          const delivery = committed.deliveries[0];
          const initialIntent = committed.intents[0];
          assert(
            delivery !== undefined && initialIntent !== undefined,
            "delivery and intent must exist",
          );
          await store.markIntentPublished(
            options.event.tenantId,
            initialIntent.id,
            options.event.committedAt,
          );

          const nextAttemptAt = new Date(options.event.committedAt.getTime() + 2_000);
          const retrying = await recordClaimedAttempt(store, options, {
            tenantId: options.event.tenantId,
            attempt: createAttempt(delivery.id, 1, options, "retryable"),
            status: "retrying",
            nextAttemptAt,
          });
          const retryIntent = (await store.listUnpublishedIntents(options.event.tenantId))[0];
          assert(retryIntent !== undefined, "retry intent must exist");
          await store.markIntentPublished(
            options.event.tenantId,
            retryIntent.id,
            options.event.committedAt,
          );
          const resumed = await store.scheduleDelivery({
            tenantId: options.event.tenantId,
            deliveryId: delivery.id,
            scheduledAt: new Date(nextAttemptAt.getTime() - 1),
          });
          const intents = await store.listUnpublishedIntents(options.event.tenantId);
          assert(intents.length === 0, "early resume must not create an intent");
          assert(
            resumed.status === retrying.status &&
              resumed.attemptCount === retrying.attemptCount &&
              resumed.nextAttemptAt?.getTime() === nextAttemptAt.getTime(),
            "early resume must return the unchanged retrying delivery",
          );
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
          await recordClaimedAttempt(store, options, {
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
          await recordClaimedAttempt(store, options, {
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
          const retryingReplay = await recordClaimedAttempt(store, options, {
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

          const deadReplay = await recordClaimedAttempt(store, options, {
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
        name: "recovers an abandoned delivery claim after its datastore lease expires",
        run: async () => {
          const store = await options.createStore();
          const committed = await store.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          const delivery = committed.deliveries[0];
          assert(delivery !== undefined, "delivery must exist");
          const claim = await store.claimDelivery(
            options.event.tenantId,
            delivery.id,
            options.event.committedAt,
            1_000,
          );
          assert(claim !== undefined, "initial claim must exist");
          assert(
            Number.isFinite(claim.leaseUntil.getTime()),
            "claim lease deadline must be a valid date",
          );
          assert(claim.delivery.id === delivery.id, "claim must identify the requested delivery");
          assert(
            (await store.claimDelivery(
              options.event.tenantId,
              delivery.id,
              new Date(options.event.committedAt.getTime() + 86_400_000),
              1_000,
            )) === undefined,
            "worker eligibility time must not expire a live datastore lease",
          );
          await expireLease(options);
          const reopened =
            options.reopenStore === undefined ? store : await options.reopenStore(store);
          const recovered = await reopened.claimDelivery(
            options.event.tenantId,
            delivery.id,
            options.event.committedAt,
            60_000,
          );
          assert(recovered !== undefined, "expired abandoned claim must be recoverable");
          assert(
            recovered.claimToken !== claim.claimToken,
            "recovered claim must receive a fresh token",
          );
          await reopened.recordAttempt({
            tenantId: options.event.tenantId,
            claimToken: recovered.claimToken,
            attempt: createAttempt(delivery.id, 1, options, "delivered"),
            status: "delivered",
          });
          assert(
            (await reopened.getDelivery(options.event.tenantId, delivery.id))?.status ===
              "delivered",
            "recovered worker must complete delivery",
          );
        },
      },
      {
        name: "rejects expired and superseded claim tokens without changing delivery evidence",
        run: async () => {
          const store = await options.createStore();
          const committed = await store.commitEvent({
            event: options.event,
            endpoints: [options.endpoint],
          });
          const delivery = committed.deliveries[0];
          assert(delivery !== undefined, "delivery must exist");
          const expired = await store.claimDelivery(
            options.event.tenantId,
            delivery.id,
            options.event.committedAt,
            1_000,
          );
          assert(expired !== undefined, "initial claim must exist");
          await expireLease(options);
          const rejectedAttempt = {
            tenantId: options.event.tenantId,
            claimToken: expired.claimToken,
            attempt: createAttempt(delivery.id, 1, options, "retryable"),
            status: "retrying" as const,
            nextAttemptAt: new Date(options.event.committedAt.getTime() + 1_000),
          };
          await assertRejectsConfigurationProblem(
            () => store.recordAttempt(rejectedAttempt),
            "expired token must not record an attempt",
          );
          assert(
            !(await store.releaseDeliveryClaim(
              options.event.tenantId,
              delivery.id,
              expired.claimToken,
            )),
            "expired token must not release a claim",
          );
          const current = await store.claimDelivery(
            options.event.tenantId,
            delivery.id,
            options.event.committedAt,
            60_000,
          );
          assert(current !== undefined, "new worker must acquire expired claim");
          await assertRejectsConfigurationProblem(
            () => store.recordAttempt(rejectedAttempt),
            "superseded token must not record an attempt",
          );
          assert(
            !(await store.releaseDeliveryClaim(
              options.event.tenantId,
              delivery.id,
              expired.claimToken,
            )),
            "superseded token must not release the current claim",
          );
          assert(
            (await store.claimDelivery(
              options.event.tenantId,
              delivery.id,
              options.event.committedAt,
              60_000,
            )) === undefined,
            "stale release must preserve the current claim",
          );
          assert(
            (await store.listAttempts(options.event.tenantId, delivery.id)).length === 0,
            "rejected writes must not append attempt evidence",
          );
          assert(
            (await store.listUnpublishedIntents(options.event.tenantId)).length === 1,
            "rejected writes must not append retry intents",
          );
          const unchanged = await store.getDelivery(options.event.tenantId, delivery.id);
          assert(
            unchanged?.status === "pending" &&
              unchanged.attemptCount === 0 &&
              unchanged.nextAttemptAt === undefined,
            "rejected writes must preserve pending delivery state",
          );
          await store.recordAttempt({
            tenantId: options.event.tenantId,
            claimToken: current.claimToken,
            attempt: createAttempt(delivery.id, 1, options, "delivered"),
            status: "delivered",
          });
          assert(
            (await store.getDelivery(options.event.tenantId, delivery.id))?.status === "delivered",
            "current token must still complete delivery",
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
            store.claimDelivery(
              options.event.tenantId,
              deliveryId,
              options.event.committedAt,
              60_000,
            ),
            store.claimDelivery(
              options.event.tenantId,
              deliveryId,
              options.event.committedAt,
              60_000,
            ),
          ]);
          assert(
            claims.filter((claim) => claim !== undefined).length === 1,
            "only one concurrent claim may succeed",
          );
          const claim = claims.find((item) => item !== undefined);
          assert(claim !== undefined, "winning claim must exist");
          assert(
            await store.releaseDeliveryClaim(options.event.tenantId, deliveryId, claim.claimToken),
            "current claim must release successfully",
          );
        },
      },
    ],
  };
}

async function recordClaimedAttempt(
  store: OutboundWebhookStore,
  options: OutboundWebhookStoreConformanceOptions,
  input: Omit<Parameters<OutboundWebhookStore["recordAttempt"]>[0], "claimToken">,
) {
  const delivery = await store.getDelivery(input.tenantId, input.attempt.deliveryId);
  assert(delivery !== undefined, "delivery must exist before recording an attempt");
  const claim = await store.claimDelivery(
    input.tenantId,
    delivery.id,
    delivery.nextAttemptAt ?? options.event.committedAt,
    60_000,
  );
  assert(claim !== undefined, "attempt must acquire an eligible delivery claim");
  try {
    return await store.recordAttempt({ ...input, claimToken: claim.claimToken });
  } finally {
    await store.releaseDeliveryClaim(input.tenantId, delivery.id, claim.claimToken);
  }
}

async function expireLease(options: OutboundWebhookStoreConformanceOptions): Promise<void> {
  if (options.advanceStoreTime !== undefined) {
    await options.advanceStoreTime(1_100);
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 1_100));
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
