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

The gateway calls the adapter's `verify()` function before handler resolution. Invalid signatures
therefore fail before a typed handler can run. Completed event ids replay the stored handled,
ignored, or reported result through `@croco/idempotency-core`; same event id with a different
fingerprint fails with `IdempotencyConflictProblem`.

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
reopen hook) to verify durability and concurrent-claim behavior.

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
Paused endpoints retain a pending delivery without a dispatch intent, and `resume(tenantId,
deliveryId)` schedules that evidence after activation. Disabled endpoints retain canceled evidence.
`dispatch`, `replay`, `resume`, diagnostics, and all store lookups require tenant context.

The default URL policy requires HTTPS, resolves DNS, and rejects embedded credentials, localhost,
private, reserved, loopback, link-local, multicast, mapped IPv6, and metadata targets. The validated
addresses are passed to `OutboundWebhookTransport`; production transports must connect only to one
of those addresses, retain the original hostname for TLS/SNI, and never auto-follow redirects. This
pins validation to the connection boundary and prevents DNS rebinding or redirect-based SSRF.
