# @croco/webhooks-core

Provider webhook boundaries share one gateway contract for signature verification, typed event dispatch,
idempotent duplicate handling, unknown event policy, and fixture replay.

## Install

```bash
pnpm add @croco/webhooks-core @croco/idempotency-core
```

## Gateway

```ts
import {
  InMemoryIdempotencyStore,
  InvalidWebhookSignatureProblem,
  WebhookGateway,
  createWebhookEventRouter,
  type WebhookGatewayStoredResult,
  type WebhookProviderAdapter,
} from "@croco/webhooks-core";

type StripeEvents = {
  "checkout.session.completed": {
    payload: { id: string; customer: string };
    result: { handled: true };
  };
};

const adapter: WebhookProviderAdapter = {
  provider: "stripe",
  verify: (request) => {
    if (request.headers["stripe-signature"] !== "valid") {
      throw new InvalidWebhookSignatureProblem({
        provider: "stripe",
        reason: "missing or invalid signature",
      });
    }

    const payload = JSON.parse(String(request.rawBody)) as {
      id: string;
      type: string;
      data: unknown;
    };
    return {
      id: payload.id,
      type: payload.type,
      payload: payload.data,
      provider: "stripe",
    };
  },
};

const router = createWebhookEventRouter<StripeEvents>().register(
  "checkout.session.completed",
  async (event) => ({ handled: true }),
);

const gateway = new WebhookGateway({
  adapter,
  router,
  idempotencyStore: new InMemoryIdempotencyStore<WebhookGatewayStoredResult>(),
  unknownEventPolicy: "fail",
});

const result = await gateway.handle({
  rawBody: JSON.stringify({
    id: "evt_123",
    type: "checkout.session.completed",
    data: { id: "cs_123", customer: "cus_123" },
  }),
  headers: { "stripe-signature": "valid" },
});
```

`idempotencyTtlMs` keeps completed or terminally failed results for 24 hours by default.
`processingLeaseMs` controls the in-flight reservation separately and defaults to 15 minutes.
After an abandoned worker's lease expires, a redelivery can run the handler again; deliveries
within the lease remain in-flight, and completed deliveries replay until the result TTL expires.
Set `processingLeaseMs` longer than the provider's response timeout and at least as long as the
handler's maximum execution time. A live handler that exceeds its lease can overlap a redelivery
and run side effects twice; the stale handler cannot commit its result over the new reservation.
Custom idempotency stores must apply `leaseMs` independently of the result TTL, pass the
idempotency store conformance suite, and declare `processingLeaseVersion: 1`. The gateway rejects
an incompatible store during construction.

The gateway calls the adapter's `verify()` function before handler resolution. Invalid signatures
therefore fail before a typed handler can run. Completed event ids replay the stored handled,
ignored, or reported result through `@croco/idempotency-core`; same event id with a different
fingerprint fails with `IdempotencyConflictProblem`.

Handler failures surface as `WebhookDispatchProblem` and unknown-event reporter failures as
`WebhookReporterProblem`, both with the `InternalServerError` category and status 500. For every
supplied `Error` cause, including SDK errors and Problems, the wrapper records the result of
`isRetryableHandlerFailure()` in `extensions.retryable`. A non-retryable failure is stored once,
and redeliveries of the same event return `outcome: "failed"` without running the handler or reporter
again. Retryable failures allow the next delivery to run the handler or reporter again.

An explicit boolean `retryable` or `extensions.retryable` flag takes precedence over HTTP `status`
for both ordinary `Error` and `Problem` causes. Without an explicit flag, a 4xx `status` other than 408
or 429 is non-retryable; with the default Problem category mapping, that is every 4xx category except
`TooManyRequests`. Errors without a recognized retry flag or status remain retryable.

A non-retryable failure remains stored for `idempotencyTtlMs` (24 hours by default). Mark a transient client error such as an out-of-order event with
`extensions.retryable: true` to keep redeliveries running. `replay()` uses the same idempotency key
and returns the stored failure until the record expires. To run the handler again sooner, keep a
reference to the store passed as `idempotencyStore` and call
`await store.expire({ key: result.idempotencyKey })` with the `failed` result of a redelivery or
`replay()`; the first delivery throws the wrapper Problem and has no result.

## Unknown Events

`unknownEventPolicy` is required and explicit:

- `fail`: throw `UnknownWebhookEventProblem`.
- `ignore`: return an `ignored` result without running a handler.
- `report`: call `unknownEventReporter` once and return a `reported` result.

## Fixtures

Replay fixtures preserve raw body and headers:

```json
{
  "provider": "stripe",
  "rawBody": "{\"id\":\"evt_123\",\"type\":\"checkout.session.completed\",\"data\":{}}",
  "headers": {
    "stripe-signature": "valid"
  }
}
```

```ts
import { loadWebhookReplayFixture } from "@croco/webhooks-core";

const fixture = await loadWebhookReplayFixture("./fixtures/stripe-checkout.json");
await gateway.replay(fixture);
```

`loadWebhookReplayFixture()` is the only Node file-system helper in this package. Runtime handlers can
use `parseWebhookReplayFixture()` or `createWebhookReplayFixture()` when fixtures are loaded by another
environment.

## Outbound tenant delivery

Outbound webhooks are a separate reliability boundary from the inbound `WebhookGateway`. An outbound
event is serialized once and committed with one idempotent delivery per subscribed tenant endpoint.
The same committed bytes and event id are reused for every attempt.

```ts
import {
  FakeOutboundWebhookTransport,
  InMemoryOutboundWebhookEndpointStore,
  InMemoryOutboundWebhookSecretStore,
  InMemoryOutboundWebhookStore,
  OutboundWebhookRuntime,
} from "@croco/webhooks-core";

const runtime = new OutboundWebhookRuntime({
  store: new InMemoryOutboundWebhookStore(),
  endpointStore: new InMemoryOutboundWebhookEndpointStore([
    {
      id: "endpoint_1",
      tenantId: "tenant_1",
      url: "https://hooks.customer.example/croco",
      subscribedEventNames: ["invoice.paid"],
      status: "active",
      signingAlgorithm: "hmac-sha256",
      activeSecretVersion: "v2",
    },
  ]),
  secretStore: new InMemoryOutboundWebhookSecretStore([
    {
      tenantId: "tenant_1",
      endpointId: "endpoint_1",
      version: "v2",
      material: new TextEncoder().encode(process.env.WEBHOOK_SECRET ?? ""),
    },
  ]),
  taskPublisher: {
    publish: async (input) => {
      // Adapt this explicit task/execution/idempotency contract to tasks-core.
      // The durable dispatch intent is the outbox boundary and can be resumed.
      await taskQueue.publish(input);
    },
  },
  transport: new FakeOutboundWebhookTransport([{ kind: "http", status: 204 }]),
});

await runtime.publish({
  id: "event_1",
  name: "invoice.paid",
  schemaVersion: "2026-07-01",
  subject: "invoice/inv_1",
  tenantId: "tenant_1",
  occurredAt: new Date(),
  payload: { invoiceId: "inv_1" },
});
```

`commitEvent()` is the transaction boundary: the immutable event, endpoint deliveries, and dispatch
intents are stored together before a task is published. `publish()` publishes only the unpublished
intents returned for that event, so older failed intents cannot block a new event. Publishing the same
event again retries its unpublished intents and skips those already acknowledged.
If publication fails after commit,
`publishUnpublishedIntents()` continues with independent intents and returns published intent IDs
plus retryable or terminal failures without payload data. Retryable intents remain unpublished so a
later invocation can resume them without creating another logical event. Shared configuration
failures stop the batch before later tasks are published. Store adapters atomically mark each intent
publication once, and task publishers must honor the stable idempotency key so concurrent drains or
a store-acknowledgement retry cannot create duplicate task, execution, or outbox records.
Persistent adapters can use `createOutboundWebhookStoreConformanceSuite()` (including its optional
reopen and datastore-clock hooks) to verify durability, concurrent claims, lease recovery, and stale
token rejection. `claimDelivery()` must atomically grant a claim using the datastore's current time,
return `{ delivery, claimToken, leaseUntil }`, and allow another worker to claim after the lease
expires. `recordAttempt()` must atomically reject an expired or replaced token before changing the
delivery, attempts, or retry intent. `releaseDeliveryClaim()` returns `false` for an expired or
replaced token, without releasing another worker's claim.

`OutboundWebhookRuntime` defaults to a 60-second claim lease and a 30-second transport timeout.
Set `claimLeaseDurationMs` longer than `transportTimeoutMs` and long enough to include signing,
transport, attempt recording, and task publication. The runtime passes an abort signal to the
transport and stops waiting when the timeout expires, even if the transport ignores the signal.
An expired claim cannot record an attempt; a later dispatch can reclaim the delivery. A timeout
leaves the delivery state unchanged for a retry and does not establish whether the remote endpoint
accepted the request.

Each attempt includes `webhook-id`, `webhook-delivery-id`, `webhook-timestamp`,
`webhook-signature-version`, and `webhook-signature`. HMAC-SHA256 signs
`<timestamp>.<exact payload bytes>`. Previous secret versions verify only during their configured
grace period. `verifyOutboundWebhookSignature()` accepts only canonical Unix-second timestamps no
more than five minutes older or newer than `now`, bounding replay and clock-skew tolerance. Secret
material is never included in Problems or diagnostics.

### Delivery policies

| Outcome                                 | Policy                                          |
| --------------------------------------- | ----------------------------------------------- |
| 200-201, 203-299                        | delivered                                       |
| 202                                     | accepted                                        |
| 400-428, 430-499                        | permanent (`dead`)                              |
| 429, 500-599                            | bounded retry                                   |
| redirect                                | permanent; redirects are never followed         |
| timeout, connection reset               | bounded retry                                   |
| request acceptance cannot be determined | `acceptance-unknown`; operator-safe replay only |

Replay schedules a new attempt on the existing endpoint delivery and is allowed only from
`delivered`, `dead`, `canceled`, or `acceptance-unknown`; it never creates a second logical delivery.
Paused endpoints retain pending deliveries without dispatch intents. After activation,
`resume(tenantId, deliveryId)` schedules a pending delivery or a retrying delivery whose
`nextAttemptAt` has passed. A retrying delivery that is not due keeps its existing schedule.
Disabled endpoints retain canceled evidence.
`dispatch`, `replay`, `resume`, diagnostics, and all store lookups require tenant context.

The default URL policy requires HTTPS, resolves DNS, and rejects embedded credentials, localhost,
private, reserved, loopback, link-local, multicast, mapped IPv6, and metadata targets. The validated
addresses are passed to `OutboundWebhookTransport`; production transports must connect only to one
of those addresses, retain the original hostname for TLS/SNI, and never auto-follow redirects. This
pins validation to the connection boundary and prevents DNS rebinding or redirect-based SSRF.
