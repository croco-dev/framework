---
"@croco/esbuild-plugin": minor
"@croco/framework-context": minor
"@croco/framework-module": minor
"@croco/protocols-rest": minor
"@croco/protocols-graphql": minor
"@croco/protocols-trpc": minor
"@croco/tasks-core": minor
"@croco/transports-http": minor
"@croco/transports-graphql": minor
"@croco/triggers-qstash": minor
"@croco/diagnostics-core": patch
"@croco/cli": patch
"@croco/framework-config": patch
"@croco/openapi-spec": patch
"@croco/problems-core": patch
"@croco/protocols-core": patch
"@croco/testing": minor
"@croco/analytics-posthog": patch
"@croco/audit-core": minor
"@croco/dataloader-core": minor
"@croco/impersonation-core": minor
"@croco/repository-core": minor
"@croco/auth-core": patch
"@croco/customer-health-core": patch
"@croco/entitlements-core": patch
"@croco/events-core": minor
"@croco/events-inmemory": patch
"@croco/features-posthog": patch
"@croco/framework-logger": patch
"@croco/integrations-posthog": minor
"@croco/invitation-core": patch
"@croco/metering-core": patch
"@croco/metrics-billing": patch
"@croco/metrics-core": patch
"@croco/notifications-core": patch
"@croco/search-core": minor
"@croco/storage-r2": patch
"@croco/tx-drizzle": minor
"@croco/tx-core": minor
"create-croco-app": minor
---

Discover Croco components by TypeScript symbol identity and generate deterministic application-scoped factories, dependency manifests, and lifecycle-aware runtime graphs during server builds.

`@Component`, `@Inject`, REST controllers, and GraphQL resolvers remain the authoring surface, but their imports no longer register services in a process-global container. Applications using custom builds must enable `crocoPlugin()` or pass a generated graph to `ApplicationRuntime`. TypeDI-specific identifiers, runtime fallback, and package dependencies are removed; dynamically computed injection tokens must migrate to concrete class types, statically referenced Croco tokens, or explicit module/plugin factories.

Business services now receive optional collaborators and loggers through constructors or function options instead of process-global container lookups. Provider inheritance is rejected by the first compiler schema; declare injected constructors and properties directly on the decorated provider. Static `di.bindings` selects token implementations, while `di.modules` defines provider ownership and import/export visibility before generated code is emitted.

`@Auditable` now requires a receiver dependency selector and `AuditInterceptor` receives its logger through its constructor. `@BatchLoad` requires a receiver factory selector, and `@BlockDuringImpersonation` requires a receiver configuration selector. Inject these collaborators into the owning instance and pass an accessor to the decorator; process-global lookup and missing-provider fallback are no longer supported. `registerBatchLoaderFactory()` is removed; construct or inject `BatchLoaderFactory` into the repository instead.

RLS adapters with `debug: true` now require an explicitly supplied logger; they no longer resolve one from the process-global container.

`@Metered` accepts an explicit logger option instead of resolving one globally. Without a reporter, local metering failures propagate rather than being silently ignored; billing-required failures remain fail-closed.

PostHog configuration is now validated with `createPostHogConfig()` and passed to an application-owned provider; `registerPostHogConfig()` no longer writes to a process-global container.

Transaction managers are now held by an application-owned `TxManagerRegistry` instance, and `@Transactional` receives a manager selector for its service instance. `EventPublisher` receives its transaction context explicitly for after-commit publication; neither path resolves a process-global transaction service.

Event subscriptions resolve class handlers through an explicitly supplied resolver; a subscription may also provide its handler directly. In-memory event buses, task runners, and QStash trigger handlers no longer read handlers or loggers from a process-global container. Supply the resolver and other collaborators at the application boundary; missing required class resolution now fails explicitly.
