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

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new OutboundWebhookConfigurationProblem(`store conformance failed: ${message}`);
  }
}

function bytesEqual(left: Uint8Array | undefined, right: Uint8Array): boolean {
  return left !== undefined && Buffer.from(left).equals(Buffer.from(right));
}
