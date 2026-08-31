import * as assert from "node:assert/strict";
import {
  EngagementDeliveryEventCorrelationProblem,
  EngagementDeliveryEventProcessor,
  StoredEngagementPolicyEvaluator,
} from "./PersistentEngagement";
import {
  EngagementStoreValidationProblem,
  type EngagementEvidence,
  type EngagementPersistence,
} from "./EngagementStores";

export type EngagementStoreConformanceCase = Readonly<{
  name: string;
  run(): Promise<void>;
}>;

export type EngagementStoreConformanceOptions = Readonly<{
  createStore(): EngagementPersistence | Promise<EngagementPersistence>;
  reopenStore?(
    store: EngagementPersistence,
  ): EngagementPersistence | Promise<EngagementPersistence>;
}>;

export type EngagementStoreConformanceSuite = Readonly<{
  cases: readonly EngagementStoreConformanceCase[];
}>;

export function createEngagementStoreConformanceSuite(
  options: EngagementStoreConformanceOptions,
): EngagementStoreConformanceSuite {
  const reopen = async (store: EngagementPersistence): Promise<EngagementPersistence> =>
    options.reopenStore === undefined ? store : options.reopenStore(store);

  return {
    cases: [
      {
        name: "persists endpoints preferences suppressions and dispatch evidence across reopen",
        run: async () => {
          const store = await options.createStore();
          const endpoint = await store.saveEndpoint(emailEndpoint("tenant-a", "recipient-a"));
          await store.setPreference({
            tenantId: "tenant-a",
            recipientId: "recipient-a",
            scope: "recipient",
            topic: "marketing.newsletter",
            channel: "email",
            state: "deny",
            source: "recipient-settings",
            changedAt: instant(1),
          });
          await store.saveSuppression({
            id: "suppression-a",
            tenantId: "tenant-a",
            endpointId: endpoint.id,
            channel: "email",
            reason: "hard-bounce",
            source: "provider-event",
            createdAt: instant(2),
          });
          const dispatch = await store.recordDispatch({
            ...identity("tenant-a", "recipient-a", "message-a", "email", "semantic-a"),
            topic: "marketing.newsletter",
            targets: [{ endpointId: endpoint.id, endpointVersion: endpoint.version }],
            outcome: { kind: "suppressed", reason: "preference" },
            recordedAt: instant(3),
          });

          const reopened = await reopen(store);

          assert.equal((await reopened.listActiveEndpoints("tenant-a", "recipient-a")).length, 1);
          assert.equal(
            (
              await reopened.resolvePreference({
                tenantId: "tenant-a",
                recipientId: "recipient-a",
                topic: "marketing.newsletter",
                channel: "email",
              })
            )?.state,
            "deny",
          );
          assert.equal(
            (
              await reopened.findActiveSuppressions({
                tenantId: "tenant-a",
                recipientId: "recipient-a",
                endpointId: endpoint.id,
                channel: "email",
                topic: "marketing.newsletter",
                at: instant(4),
              })
            ).length,
            1,
          );
          assert.equal((await reopened.getDispatch("tenant-a", dispatch.id))?.id, dispatch.id);
        },
      },
      {
        name: "isolates every recipient-owned lookup and mutation by tenant",
        run: async () => {
          const store = await options.createStore();
          const first = await store.saveEndpoint(emailEndpoint("tenant-a", "shared-recipient"));
          const second = await store.saveEndpoint({
            ...emailEndpoint("tenant-b", "shared-recipient"),
            address: "tenant-b@example.invalid",
          });
          assert.equal(first.id, second.id);
          assert.equal((await store.getEndpoint("tenant-a", first.id))?.tenantId, "tenant-a");
          assert.equal((await store.getEndpoint("tenant-b", first.id))?.tenantId, "tenant-b");
          assert.equal(
            (await store.listActiveEndpoints("tenant-a", "shared-recipient"))[0]?.tenantId,
            "tenant-a",
          );
          assert.equal(
            (await store.listActiveEndpoints("tenant-b", "shared-recipient"))[0]?.tenantId,
            "tenant-b",
          );
          assert.equal((await store.listActiveEndpoints("tenant-c", "shared-recipient")).length, 0);

          const invalidation = await store.invalidateEndpoint({
            tenantId: "tenant-b",
            endpointId: first.id,
            expectedVersion: first.version,
            reason: "manual",
            invalidatedAt: instant(2),
          });
          assert.equal(invalidation.status, "invalidated");
          assert.equal((await store.listActiveEndpoints("tenant-a", "shared-recipient")).length, 1);
          assert.equal((await store.listActiveEndpoints("tenant-b", "shared-recipient")).length, 0);

          await store.setPreference({
            tenantId: "tenant-a",
            recipientId: "shared-recipient",
            scope: "recipient",
            topic: "shared-topic",
            channel: "email",
            state: "allow",
            source: "tenant-a-fixture",
            changedAt: instant(3),
          });
          await store.setPreference({
            tenantId: "tenant-b",
            recipientId: "shared-recipient",
            scope: "recipient",
            topic: "shared-topic",
            channel: "email",
            state: "deny",
            source: "tenant-b-fixture",
            changedAt: instant(3),
          });
          assert.equal(
            (
              await store.resolvePreference({
                tenantId: "tenant-a",
                recipientId: "shared-recipient",
                topic: "shared-topic",
                channel: "email",
              })
            )?.state,
            "allow",
          );
          assert.equal(
            (
              await store.resolvePreference({
                tenantId: "tenant-b",
                recipientId: "shared-recipient",
                topic: "shared-topic",
                channel: "email",
              })
            )?.state,
            "deny",
          );

          for (const [tenantId, reason] of [
            ["tenant-a", "tenant-a-reason"],
            ["tenant-b", "tenant-b-reason"],
          ] as const) {
            await store.saveSuppression({
              id: "shared-suppression",
              tenantId,
              recipientId: "shared-recipient",
              endpointId: "shared-endpoint",
              channel: "email",
              topic: "shared-topic",
              reason,
              source: "tenant-fixture",
              createdAt: instant(4),
            });
          }
          const suppressionLookup = {
            recipientId: "shared-recipient",
            endpointId: "shared-endpoint",
            channel: "email" as const,
            topic: "shared-topic",
            at: instant(5),
          };
          assert.equal(
            (await store.findActiveSuppressions({ tenantId: "tenant-a", ...suppressionLookup }))[0]
              ?.reason,
            "tenant-a-reason",
          );
          assert.equal(
            (await store.findActiveSuppressions({ tenantId: "tenant-b", ...suppressionLookup }))[0]
              ?.reason,
            "tenant-b-reason",
          );

          const dispatchA = await store.recordDispatch({
            ...identity(
              "tenant-a",
              "shared-recipient",
              "shared-message",
              "email",
              "shared-semantic",
            ),
            topic: "shared-topic",
            targets: [{ endpointId: first.id, endpointVersion: first.version }],
            outcome: { kind: "queued", executionIds: ["execution-a"] },
            recordedAt: instant(6),
          });
          const dispatchB = await store.recordDispatch({
            ...identity(
              "tenant-b",
              "shared-recipient",
              "shared-message",
              "email",
              "shared-semantic",
            ),
            topic: "shared-topic",
            targets: [{ endpointId: second.id, endpointVersion: second.version }],
            outcome: { kind: "queued", executionIds: ["execution-b"] },
            recordedAt: instant(6),
          });
          assert.notEqual(dispatchA.id, dispatchB.id);
          assert.equal(await store.getDispatch("tenant-a", dispatchB.id), undefined);
          assert.equal(
            (
              await store.findByIdentity(
                identity(
                  "tenant-a",
                  "shared-recipient",
                  "shared-message",
                  "email",
                  "shared-semantic",
                ),
              )
            )?.id,
            dispatchA.id,
          );
          assert.deepEqual(
            (await store.listByRecipient("tenant-a", "shared-recipient", { limit: 10 })).items.map(
              (dispatch) => dispatch.id,
            ),
            [dispatchA.id],
          );

          const eventInput = {
            provider: "shared-provider",
            providerEventId: "shared-provider-event",
            endpointId: "shared-endpoint",
            type: "delivered" as const,
            occurredAt: instant(7),
            recordedAt: instant(8),
          };
          await store.recordDeliveryEvent({
            tenantId: "tenant-a",
            dispatchId: dispatchA.id,
            ...eventInput,
          });
          await store.recordDeliveryEvent({
            tenantId: "tenant-b",
            dispatchId: dispatchB.id,
            ...eventInput,
          });
          assert.equal((await store.listByDispatch("tenant-a", dispatchA.id)).length, 1);
          assert.equal((await store.listByDispatch("tenant-a", dispatchB.id)).length, 0);
          assert.equal((await store.listByDispatch("tenant-b", dispatchB.id)).length, 1);
        },
      },
      {
        name: "rejects body-shaped delivery evidence and preserves allowed provider identifiers",
        run: async () => {
          const store = await options.createStore();
          const bodyShapedEvidence = {
            providerCode: "550",
            responseBody: "authorization=raw-secret",
          } as unknown as EngagementEvidence;

          await assert.rejects(
            () =>
              store.setPreference({
                tenantId: "tenant-evidence",
                scope: "tenant",
                topic: "marketing.evidence",
                channel: "email",
                state: "deny",
                source: "fixture",
                changedAt: instant(1),
                evidence: bodyShapedEvidence,
              }),
            EngagementStoreValidationProblem,
          );
          await assert.rejects(
            () =>
              store.saveSuppression({
                id: "suppression-evidence",
                tenantId: "tenant-evidence",
                recipientId: "recipient-evidence",
                channel: "email",
                reason: "provider-rejected",
                source: "fixture",
                createdAt: instant(1),
                evidence: { providerCode: '{"authorization":"raw-secret"}' },
              }),
            EngagementStoreValidationProblem,
          );
          await assert.rejects(
            () =>
              store.recordDeliveryEvent({
                tenantId: "tenant-evidence",
                provider: "fixture-provider",
                providerEventId: "provider-event-evidence",
                dispatchId: "dispatch-evidence",
                endpointId: "endpoint-evidence",
                type: "failed",
                occurredAt: instant(1),
                recordedAt: instant(2),
                evidence: bodyShapedEvidence,
              }),
            EngagementStoreValidationProblem,
          );

          await store.setPreference({
            tenantId: "tenant-evidence",
            scope: "tenant",
            topic: "marketing.evidence",
            channel: "email",
            state: "deny",
            source: "fixture",
            changedAt: instant(3),
            evidence: { providerCategory: "permanent-failure", providerCode: "550" },
          });
          assert.deepEqual(
            (
              await store.resolvePreference({
                tenantId: "tenant-evidence",
                recipientId: "recipient-evidence",
                topic: "marketing.evidence",
                channel: "email",
              })
            )?.evidence,
            { providerCategory: "permanent-failure", providerCode: "550" },
          );
        },
      },
      {
        name: "resolves recipient preference before tenant default and fails closed without an explicit global default",
        run: async () => {
          const store = await options.createStore();
          await store.setPreference({
            tenantId: "tenant-policy",
            scope: "tenant",
            topic: "marketing.offer",
            channel: "email",
            state: "deny",
            source: "tenant-default",
            changedAt: instant(1),
          });
          await store.setPreference({
            tenantId: "tenant-policy",
            recipientId: "recipient-allow",
            scope: "recipient",
            topic: "marketing.offer",
            channel: "email",
            state: "allow",
            source: "recipient-choice",
            changedAt: instant(2),
          });
          const policy = new StoredEngagementPolicyEvaluator(store, store, {
            clock: () => instant(3),
          });

          assert.deepEqual(
            await policy.evaluate(
              policyContext("tenant-policy", "recipient-allow", "marketing.offer"),
            ),
            { suppressed: false, kind: "preference", reason: "recipient-allow" },
          );
          assert.deepEqual(
            await policy.evaluate(
              policyContext("tenant-policy", "recipient-deny", "marketing.offer"),
            ),
            { suppressed: true, kind: "preference", reason: "tenant-deny" },
          );
          assert.deepEqual(
            await policy.evaluate(
              policyContext("tenant-policy", "recipient-deny", "marketing.unknown"),
            ),
            { suppressed: true, kind: "preference", reason: "explicit-default-required" },
          );
        },
      },
      {
        name: "deduplicates delivery events and applies terminal endpoint invalidation once",
        run: async () => {
          const store = await options.createStore();
          const endpoint = await store.saveEndpoint(
            emailEndpoint("tenant-events", "recipient-events"),
          );
          const dispatch = await store.recordDispatch({
            ...identity(
              "tenant-events",
              "recipient-events",
              "message-events",
              "email",
              "semantic-events",
            ),
            topic: "system.receipt",
            targets: [{ endpointId: endpoint.id, endpointVersion: endpoint.version }],
            outcome: { kind: "queued", executionIds: ["execution-events"] },
            recordedAt: instant(2),
          });
          const processor = new EngagementDeliveryEventProcessor(store);
          const event = {
            tenantId: "tenant-events",
            provider: "fixture-provider",
            providerEventId: "provider-event-1",
            dispatchId: dispatch.id,
            endpointId: endpoint.id,
            type: "bounced" as const,
            occurredAt: instant(3),
            evidence: { bounceKind: "hard" as const, providerCode: "550" },
            recordedAt: instant(4),
          };

          const first = await processor.process(event);
          const replay = await processor.process(event);

          assert.equal(first.event.duplicate, false);
          assert.equal(first.invalidation?.status, "invalidated");
          assert.equal(replay.event.duplicate, true);
          assert.equal(replay.invalidation, undefined);
          assert.equal((await store.listByDispatch("tenant-events", dispatch.id)).length, 1);
          assert.equal(
            (await store.listActiveEndpoints("tenant-events", "recipient-events")).length,
            0,
          );
          const replayedEmail = await store.saveEndpoint(
            emailEndpoint("tenant-events", "recipient-events"),
          );
          assert.ok(replayedEmail.invalidatedAt);
          assert.equal(
            (await store.listActiveEndpoints("tenant-events", "recipient-events")).length,
            0,
          );

          const push = await store.saveEndpoint(pushEndpoint("tenant-events", "recipient-events"));
          const pushDispatch = await store.recordDispatch({
            ...identity(
              "tenant-events",
              "recipient-events",
              "message-push-events",
              "push",
              "semantic-push-events",
            ),
            topic: "system.security",
            targets: [{ endpointId: push.id, endpointVersion: push.version }],
            outcome: { kind: "queued", executionIds: ["execution-push-events"] },
            recordedAt: instant(5),
          });
          const invalidPush = await processor.process({
            tenantId: "tenant-events",
            provider: "fixture-provider",
            providerEventId: "provider-event-push-invalid",
            dispatchId: pushDispatch.id,
            endpointId: push.id,
            type: "token-invalid",
            occurredAt: instant(6),
            recordedAt: instant(7),
          });

          assert.equal(invalidPush.invalidation?.status, "invalidated");
          assert.equal(
            (await store.listActiveEndpoints("tenant-events", "recipient-events")).length,
            0,
          );
          const replayedPush = await store.saveEndpoint(
            pushEndpoint("tenant-events", "recipient-events"),
          );
          assert.ok(replayedPush.invalidatedAt);
          assert.equal(
            (await store.listActiveEndpoints("tenant-events", "recipient-events")).length,
            0,
          );
        },
      },
      {
        name: "does not let stale delivery evidence invalidate a renewed endpoint",
        run: async () => {
          const store = await options.createStore();
          const first = await store.saveEndpoint(pushEndpoint("tenant-cas", "recipient-cas"));
          const dispatch = await store.recordDispatch({
            ...identity("tenant-cas", "recipient-cas", "message-cas", "push", "semantic-cas"),
            topic: "system.security",
            targets: [{ endpointId: first.id, endpointVersion: first.version }],
            outcome: { kind: "queued", executionIds: ["execution-cas"] },
            recordedAt: instant(2),
          });
          const renewed = await store.saveEndpoint({
            ...pushEndpoint("tenant-cas", "recipient-cas"),
            tokenReference: "secret://push/renewed",
            lastSeenAt: instant(3),
          });

          const result = await new EngagementDeliveryEventProcessor(store).process({
            tenantId: "tenant-cas",
            provider: "fixture-provider",
            providerEventId: "provider-event-stale",
            dispatchId: dispatch.id,
            endpointId: first.id,
            type: "token-invalid",
            occurredAt: instant(4),
            recordedAt: instant(5),
          });

          assert.equal(result.invalidation?.status, "version-mismatch");
          assert.equal(
            (await store.listActiveEndpoints("tenant-cas", "recipient-cas"))[0]?.version,
            renewed.version,
          );
        },
      },
      {
        name: "rejects delivery events for endpoints that were never dispatched",
        run: async () => {
          const store = await options.createStore();
          const endpoint = await store.saveEndpoint(
            emailEndpoint("tenant-undispatched", "recipient-undispatched"),
          );
          const dispatch = await store.recordDispatch({
            ...identity(
              "tenant-undispatched",
              "recipient-undispatched",
              "message-undispatched",
              "email",
              "semantic-undispatched",
            ),
            topic: "system.receipt",
            targets: [{ endpointId: endpoint.id, endpointVersion: endpoint.version }],
            outcome: { kind: "suppressed", reason: "preference" },
            recordedAt: instant(2),
          });

          await assert.rejects(
            () =>
              new EngagementDeliveryEventProcessor(store).process({
                tenantId: "tenant-undispatched",
                provider: "fixture-provider",
                providerEventId: "provider-event-undispatched",
                dispatchId: dispatch.id,
                endpointId: endpoint.id,
                type: "bounced",
                occurredAt: instant(3),
                evidence: { bounceKind: "hard" },
                recordedAt: instant(4),
              }),
            EngagementDeliveryEventCorrelationProblem,
          );
          assert.equal((await store.listByDispatch("tenant-undispatched", dispatch.id)).length, 0);
          assert.equal(
            (await store.listActiveEndpoints("tenant-undispatched", "recipient-undispatched"))
              .length,
            1,
          );
        },
      },
      {
        name: "keeps one logical dispatch identity and paginates tied history deterministically",
        run: async () => {
          const store = await options.createStore();
          const sharedIdentity = identity(
            "tenant-history",
            "recipient-history",
            "message-history",
            "email",
            "semantic-history",
          );
          const first = await store.recordDispatch({
            ...sharedIdentity,
            topic: "system.receipt",
            targets: [],
            outcome: { kind: "unavailable", reason: "no-endpoint" },
            recordedAt: instant(10),
          });
          const replay = await store.recordDispatch({
            ...sharedIdentity,
            topic: "system.receipt",
            targets: [],
            outcome: { kind: "suppressed", reason: "preference" },
            recordedAt: instant(11),
          });
          assert.equal(replay.id, first.id);
          assert.deepEqual(replay.outcome, first.outcome);

          for (const [messageId, semanticKey] of [
            ["message-history-b", "semantic-b"],
            ["message-history-c", "semantic-c"],
          ] as const) {
            await store.recordDispatch({
              ...identity("tenant-history", "recipient-history", messageId, "email", semanticKey),
              topic: "system.receipt",
              targets: [],
              outcome: { kind: "unavailable", reason: "no-endpoint" },
              recordedAt: instant(10),
            });
          }

          const pageOne = await store.listByRecipient("tenant-history", "recipient-history", {
            limit: 2,
          });
          assert.equal(pageOne.items.length, 2);
          assert.ok(pageOne.nextCursor);
          const pageTwo = await store.listByRecipient("tenant-history", "recipient-history", {
            limit: 2,
            after: pageOne.nextCursor,
          });
          assert.equal(pageTwo.items.length, 1);
          assert.equal(
            new Set([...pageOne.items, ...pageTwo.items].map((item) => item.id)).size,
            3,
          );
        },
      },
      {
        name: "keeps provider and network failures distinct from policy outcomes",
        run: async () => {
          const store = await options.createStore();
          const providerFailure = await store.recordDispatch({
            ...identity(
              "tenant-failures",
              "recipient-failures",
              "message-provider",
              "email",
              "semantic-provider",
            ),
            topic: "system.receipt",
            targets: [],
            outcome: {
              kind: "failed",
              stage: "provider",
              failureCode: "provider-rejected",
              retryable: false,
              executionIds: [],
            },
            recordedAt: instant(1),
          });
          const networkFailure = await store.recordDispatch({
            ...identity(
              "tenant-failures",
              "recipient-failures",
              "message-network",
              "email",
              "semantic-network",
            ),
            topic: "system.receipt",
            targets: [],
            outcome: {
              kind: "failed",
              stage: "network",
              failureCode: "network-unavailable",
              retryable: true,
              executionIds: [],
            },
            recordedAt: instant(2),
          });

          assert.deepEqual(providerFailure.outcome, {
            kind: "failed",
            stage: "provider",
            failureCode: "provider-rejected",
            retryable: false,
            executionIds: [],
          });
          assert.deepEqual(networkFailure.outcome, {
            kind: "failed",
            stage: "network",
            failureCode: "network-unavailable",
            retryable: true,
            executionIds: [],
          });
        },
      },
      {
        name: "rolls back cross-store mutations when a transaction fails",
        run: async () => {
          const store = await options.createStore();
          await assert.rejects(() =>
            store.transaction(async (stores) => {
              await stores.saveEndpoint(emailEndpoint("tenant-rollback", "recipient-rollback"));
              throw new EngagementStoreValidationProblem("Rollback fixture");
            }),
          );
          assert.equal(
            (await store.listActiveEndpoints("tenant-rollback", "recipient-rollback")).length,
            0,
          );
        },
      },
    ],
  };
}

function emailEndpoint(tenantId: string, recipientId: string) {
  return {
    id: "shared-endpoint",
    tenantId,
    recipientId,
    kind: "email" as const,
    address: `${recipientId}@example.invalid`,
    lastSeenAt: instant(1),
  };
}

function pushEndpoint(tenantId: string, recipientId: string) {
  return {
    id: "shared-push-endpoint",
    tenantId,
    recipientId,
    kind: "push" as const,
    provider: "fixture-provider",
    app: "fixture-app",
    platform: "ios",
    environment: "production",
    tokenReference: "secret://push/original",
    lastSeenAt: instant(1),
  };
}

function identity(
  tenantId: string,
  recipientId: string,
  messageId: string,
  channel: "email" | "push",
  semanticKey: string,
) {
  return { tenantId, recipientId, messageId, channel, semanticKey };
}

function policyContext(tenantId: string, userId: string, topic: string) {
  return {
    recipient: { tenantId, userId },
    messageId: "message-policy",
    topic,
    channel: "email" as const,
    endpointId: "endpoint-policy",
  };
}

function instant(offset: number): Date {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, offset));
}
