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
