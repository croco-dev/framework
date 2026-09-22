# Recipes

Use these as navigation routes, not copy-paste implementations. Open the linked executable example from the generated [package selection](package-selection.md), inspect its current plugin factory, and adapt the application's explicit composition root.

## Authentication

Start from `@croco/auth-core/AuthProvider`. Choose a listed auth plugin only when its runtime and capabilities match. Both current first-party options are pre-production, so preserve that readiness limitation in the result. If the runtime has no compatible option, implement an application-owned `AuthProvider` adapter and keep controllers and services on the contract.

## Billing

Start from `@croco/billing-core/BillingGateway`. Inspect the provider's capability metadata as well as its package maturity; a provider can support checkout while omitting another billing capability. Keep webhook validation, idempotency, and retry behavior in the verification scope.

## Persistence and transactions

Start from `@croco/tx-core/TxManager` and compose the transaction plugin through the application. An empty runtime list in the catalog means compatibility is unclaimed, not universal. Confirm the database driver and deployment runtime before selection.

## Tasks

Start from `@croco/tasks-core/TaskDispatcher`. Verify destination configuration, retry/terminal classification, redaction, and the no-credential path. Report missing live-provider evidence instead of treating local construction as certification.

## Telemetry

Keep instrumentation on `@croco/telemetry-api`. Select the SDK plugin for the actual host runtime, initialize it through the application/plugin lifecycle, and verify flush behavior at invocation or shutdown boundaries. Do not introduce direct singleton initialization into new composition roots.

## Transport and runtime

Treat protocol, transport, host, and build target as separate choices. Select a transport/host composition whose derived runtime includes the project's platform, then follow the linked Node, Lambda, or Worker example. Do not use a build target as a runtime host or assume a transport owns environment lifecycle.
