# @croco/testing

First-class test harness utilities for Croco applications.

```typescript
import { createTestingApp } from "@croco/testing";

const app = createTestingApp({ controllers: [UserController] });
const response = await app.get("/users");
```

## API

| Helper                                            | Purpose                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `createTestingApp(config)`                        | Creates an isolated `CrocoApp` with seeded test defaults and HTTP request helpers.            |
| `createTestingHarness(app)`                       | Wraps an existing `CrocoApp` with the same request and contract helpers.                      |
| `createEventTestingHarness(config)`               | Creates an isolated in-memory event bus and dispatches decorated handlers.                    |
| `createTestingRequestContext(config)`             | Builds a deterministic request/runtime context for service tests.                             |
| `runWithTestingContext(fn, config)`               | Runs code inside Croco `Context` and clears AsyncLocalStorage state when execution completes. |
| `createTestingTransactionContext(config)`         | Provides explicit in-transaction and after-commit hook behavior for tests.                    |
| `resetCrocoTestingContext()`                      | Resets the Croco DI container and seeds test logger/error/health defaults.                    |
| `installTestingTelemetryCapture()`                | Captures spans in memory without starting an SDK exporter.                                    |
| `assertProblemResponse(response, expected)`       | Verifies an RFC 7807 Problem Details response without depending on a test runner.             |
| `assertOpenAPIRoute(controllersOrSpec, expected)` | Verifies generated OpenAPI route metadata and response contracts.                             |
| `createRpcTestFetch(app)`                         | Returns a fetch-compatible function that routes generated RPC clients into the in-memory app. |
| `createBillingProviderConformanceSuite(config)`   | Builds runner-neutral billing gateway and webhook conformance cases for provider packages.    |

## Isolation Contract

`createTestingApp`, `createEventTestingHarness`, and `resetCrocoTestingContext` reset the Croco DI
container, install a silent logger, replace the health/error defaults, and seed an inactive
`TestingTransactionContext` unless `transactionContext: false` is passed. Request helpers execute
through the real HTTP route registrar and `Context.run`, so request-scoped dependencies and
AsyncLocalStorage cleanup match the runtime path.

The harness intentionally does not start a Node server, Lambda adapter, Cloudflare execution
context, OpenTelemetry SDK exporter, real database transaction, or external event broker. Use
`createTestingRequestContext` to model runtime capabilities explicitly, `TestingTransactionContext`
to flush after-commit hooks, and `installTestingTelemetryCapture` to assert span names, attributes,
events, status, and recorded exceptions in memory.

`installTestingTelemetryCapture` installs an OpenTelemetry tracer provider for the current process.
Call it before initializing a real telemetry SDK in the same test process. Repeated calls are
supported for isolated captures, including overlapping `capture.run()` blocks, but OpenTelemetry
does not expose a safe provider reset API after a different provider has already been installed.

## Event Handlers

```typescript
import { createEventTestingHarness } from "@croco/testing";
import { DomainEvent, RegisterEventHandler, type EventHandler } from "@croco/events-core";

class UserCreatedEvent extends DomainEvent {
  static eventName = "user.created";
}

@RegisterEventHandler(UserCreatedEvent)
class UserCreatedHandler implements EventHandler<UserCreatedEvent> {
  handle(event: UserCreatedEvent) {
    // Assert side effects against in-memory collaborators.
  }
}

const events = await createEventTestingHarness({ handlers: [UserCreatedHandler] });
await events.dispatch(new UserCreatedEvent());
```

## Provider Conformance

`createBillingProviderConformanceSuite()` returns plain async cases that can be used with Vitest,
Jest, or another runner. The billing suite checks checkout creation, customer portal access,
subscription cancel/resume lifecycle behavior, optional provider failure scenarios, signed webhook
handling, webhook idempotency, and invalid webhook rejection as Croco `Problem` instances.
