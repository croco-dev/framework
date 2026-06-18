# SaaS Billing Golden Path Example

This example shows one complete Croco SaaS flow: a customer checks out a paid plan, the service retries a transient payment failure, persists the paid order in a transaction, publishes a domain event after commit, records a backoffice audit projection, and exposes RFC 7807 Problems for recovery paths.

## Architecture Map

| Layer        | Example role                                          | Files and packages                                                                                 |
| ------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Framework    | DI, logger token, request/runtime context boundaries  | `@croco/framework-context`, `src/app/bootstrap.ts`                                                 |
| Protocols    | REST route metadata and parameter binding             | `@croco/protocols-rest`, `src/protocols/BillingController.ts`                                      |
| Transports   | Local HTTP and AWS Lambda execution                   | `@croco/transports-http`, `createApp()`, `src/index.ts`                                            |
| Domain       | Checkout orchestration, explicit Problems, repository | `src/domain/CheckoutService.ts`, `src/domain/InMemoryOrderRepository.ts`, `src/domain/Problems.ts` |
| Events       | After-commit domain event and projection              | `@croco/events-core`, `@croco/events-inmemory`, `src/events/OrderPaidEvent.ts`                     |
| Resilience   | Transient payment retry and terminal decline handling | `@croco/retry-core`, `src/integrations/ScriptedPaymentGateway.ts`                                  |
| Transactions | Save order and publish event only after commit        | `@croco/tx-core`, `src/integrations/InMemoryTxAdapter.ts`                                          |
| Telemetry    | Checkout span and lifecycle events                    | `@croco/telemetry-api`, `withSpan()`, `recordEvent()`, Lambda `flush` hook in `src/index.ts`       |
| Testing      | Executable HTTP harness and Problem assertions        | `@croco/testing`, `src/tests/golden-path.spec.ts`                                                  |

Primary action: `POST /api/checkouts` creates a paid order.

Success state: the response returns a paid order, `GET /api/orders/:id` reads it, and `GET /api/backoffice/audit` shows the after-commit audit entry.

Failure states: invalid checkout input returns `golden-path/checkout-validation`; terminal card decline returns `golden-path/payment-declined` without retrying or persisting an order; missing orders return `golden-path/order-not-found`.

## Run Locally

From the repository root:

```bash
pnpm --filter @croco-example/saas-billing-golden-path dev
```

Create a checkout that retries once before succeeding:

```bash
curl -X POST http://localhost:3000/api/checkouts \
  -H "Content-Type: application/json" \
  -d '{"customerId":"cus_acme","planId":"growth","seats":3,"paymentToken":"retry_once"}'
```

Read the order:

```bash
curl http://localhost:3000/api/orders/ord_0001
```

Read the backoffice audit projection:

```bash
curl http://localhost:3000/api/backoffice/audit
```

Trigger a terminal payment Problem:

```bash
curl -X POST http://localhost:3000/api/checkouts \
  -H "Content-Type: application/json" \
  -d '{"customerId":"cus_acme","planId":"starter","seats":1,"paymentToken":"card_declined"}'
```

## Validate

The example participates in workspace builds, typechecks, and tests:

```bash
pnpm --filter @croco-example/saas-billing-golden-path test
pnpm --filter @croco-example/saas-billing-golden-path typecheck
pnpm --filter @croco-example/saas-billing-golden-path build
```

The Vitest suite executes the real HTTP transport with `@croco/testing`, proving the success path, retry behavior, after-commit event projection, validation Problem, terminal payment Problem, and not-found Problem.

## Deploy

Use `src/index.ts` as the Lambda entry point:

```text
handler = src/index.handler
```

The exported handler awaits the initialized Croco app and passes a Lambda `flush` callback to `app.lambdaHandler({ flush })`. In this self-contained example the flush hook is an in-memory counter; in a deployed service, replace `flushTelemetry` in `src/app/bootstrap.ts` with `TelemetryRuntime.forceFlush()` from `@croco/telemetry-sdk-node` after initializing the SDK at module scope.

No cloud credentials are required for local validation. Production adapters can replace `ScriptedPaymentGateway`, `InMemoryOrderRepository`, `InMemoryEventBus`, and `InMemoryTxAdapter` without changing `BillingController` or the checkout recovery contract.
