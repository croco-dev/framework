# @croco/esbuild-plugin

## 0.1.0

### Minor Changes

- 3342494: Discover Croco components by TypeScript symbol identity and generate deterministic application-scoped factories, dependency manifests, and lifecycle-aware runtime graphs during server builds.

  `@Component`, `@Inject`, REST controllers, and GraphQL resolvers remain the authoring surface, but their imports no longer register services in a process-global container. Applications using custom builds must enable `crocoPlugin()` or pass a generated graph to `ApplicationRuntime`. TypeDI-specific identifiers, runtime fallback, and package dependencies are removed; dynamically computed injection tokens must migrate to concrete class types, statically referenced Croco tokens, or explicit module/plugin factories.

  Business services now receive optional collaborators and loggers through constructors or function options instead of process-global container lookups. Provider inheritance is rejected by the first compiler schema; declare injected constructors and properties directly on the decorated provider. Static `di.bindings` selects token implementations, while `di.modules` defines provider ownership and import/export visibility before generated code is emitted.

  `@Auditable` now requires a receiver dependency selector and `AuditInterceptor` receives its logger through its constructor. `@BatchLoad` requires a receiver factory selector, and `@BlockDuringImpersonation` requires a receiver configuration selector. Inject these collaborators into the owning instance and pass an accessor to the decorator; process-global lookup and missing-provider fallback are no longer supported. `registerBatchLoaderFactory()` is removed; construct or inject `BatchLoaderFactory` into the repository instead.

  RLS adapters with `debug: true` now require an explicitly supplied logger; they no longer resolve one from the process-global container.

  `@Metered` accepts an explicit logger option instead of resolving one globally. Without a reporter, local metering failures propagate rather than being silently ignored; billing-required failures remain fail-closed.

  PostHog configuration is now validated with `createPostHogConfig()` and passed to an application-owned provider; `registerPostHogConfig()` no longer writes to a process-global container.

  Transaction managers are now held by an application-owned `TxManagerRegistry` instance, and `@Transactional` receives a manager selector for its service instance. `EventPublisher` receives its transaction context explicitly for after-commit publication; neither path resolves a process-global transaction service.

  Event subscriptions resolve class handlers through an explicitly supplied resolver; a subscription may also provide its handler directly. In-memory event buses, task runners, and QStash trigger handlers no longer read handlers or loggers from a process-global container. Supply the resolver and other collaborators at the application boundary; missing required class resolution now fails explicitly.

### Patch Changes

- 7cdfcae: Declare audited package side effects so bundlers remove pure imports while preserving required initialization and CSS.
- 2737eaa: Keep published runtime peer compatibility on the dependency versions Croco verifies, and reject unbounded future dependency trains.
- b3c018b: Emit valid registry imports for TSX components by deriving decorated export
  symbol names from scanner output instead of the file basename, and normalize
  both `.ts` and `.tsx` module suffixes in generated import paths.
- 67e0cbe: fix: resolve published package types before runtime conditions
- 157089a: Remove package-local registry publish commands so releases can only write through the protected Changesets workflow.
- 5d54fb4: declare Apache-2.0 license across all publishable package manifests and ship LICENSE in published packages
- 7b0afc7: Preserve TSX parsing when the Croco plugin injects metadata or component imports into JSX entry points.
- a75563f: Require TypeScript 6 consumers while preserving Croco 1.x legacy decorator metadata and generated application
  compiler settings.

## 0.0.4

### Patch Changes

- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
