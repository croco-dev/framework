# @croco/features-posthog

## 0.0.5

### Patch Changes

- b278729: - fix: block critical test tooling advisories
- 7cdfcae: Declare audited package side effects so bundlers remove pure imports while preserving required initialization and CSS.
- 3342494: Discover Croco components by TypeScript symbol identity and generate deterministic application-scoped factories, dependency manifests, and lifecycle-aware runtime graphs during server builds.

  `@Component`, `@Inject`, REST controllers, and GraphQL resolvers remain the authoring surface, but their imports no longer register services in a process-global container. Applications using custom builds must enable `crocoPlugin()` or pass a generated graph to `ApplicationRuntime`. TypeDI-specific identifiers, runtime fallback, and package dependencies are removed; dynamically computed injection tokens must migrate to concrete class types, statically referenced Croco tokens, or explicit module/plugin factories.

  Business services now receive optional collaborators and loggers through constructors or function options instead of process-global container lookups. Provider inheritance is rejected by the first compiler schema; declare injected constructors and properties directly on the decorated provider. Static `di.bindings` selects token implementations, while `di.modules` defines provider ownership and import/export visibility before generated code is emitted.

  `@Auditable` now requires a receiver dependency selector and `AuditInterceptor` receives its logger through its constructor. `@BatchLoad` requires a receiver factory selector, and `@BlockDuringImpersonation` requires a receiver configuration selector. Inject these collaborators into the owning instance and pass an accessor to the decorator; process-global lookup and missing-provider fallback are no longer supported. `registerBatchLoaderFactory()` is removed; construct or inject `BatchLoaderFactory` into the repository instead.

  RLS adapters with `debug: true` now require an explicitly supplied logger; they no longer resolve one from the process-global container.

  `@Metered` accepts an explicit logger option instead of resolving one globally. Without a reporter, local metering failures propagate rather than being silently ignored; billing-required failures remain fail-closed.

  PostHog configuration is now validated with `createPostHogConfig()` and passed to an application-owned provider; `registerPostHogConfig()` no longer writes to a process-global container.

  Transaction managers are now held by an application-owned `TxManagerRegistry` instance, and `@Transactional` receives a manager selector for its service instance. `EventPublisher` receives its transaction context explicitly for after-commit publication; neither path resolves a process-global transaction service.

  Event subscriptions resolve class handlers through an explicitly supplied resolver; a subscription may also provide its handler directly. In-memory event buses, task runners, and QStash trigger handlers no longer read handlers or loggers from a process-global container. Supply the resolver and other collaborators at the application boundary; missing required class resolution now fails explicitly.

- 96e1678: Honor validated explicit tenant context when deriving PostHog groups, distinct IDs, and provider properties.
- 67e0cbe: fix: resolve published package types before runtime conditions
- 1c843a5: Preserve runtime class-decorator metadata in published ESM and CJS bundles so Croco can resolve concrete constructor dependencies from installed packages.
- 5d54fb4: declare Apache-2.0 license across all publishable package manifests and ship LICENSE in published packages
- Updated dependencies [4ca14ab]
- Updated dependencies [38cba9c]
- Updated dependencies [b278729]
- Updated dependencies [7008727]
- Updated dependencies [868ea09]
- Updated dependencies [7cdfcae]
- Updated dependencies [9404839]
- Updated dependencies [26f4b9e]
- Updated dependencies [2cc5438]
- Updated dependencies [3342494]
- Updated dependencies [7df16bb]
- Updated dependencies [0fa2546]
- Updated dependencies [008f3f0]
- Updated dependencies [6489abb]
- Updated dependencies [dda0a50]
- Updated dependencies [7d248c5]
- Updated dependencies [be7408f]
- Updated dependencies [16cc286]
- Updated dependencies [eed5e70]
- Updated dependencies [cfdc20a]
- Updated dependencies [67e0cbe]
- Updated dependencies [e3bb85e]
- Updated dependencies [651bc2a]
- Updated dependencies [1c843a5]
- Updated dependencies [45882f1]
- Updated dependencies [f0c328e]
- Updated dependencies [6bac6de]
- Updated dependencies [efb33f9]
- Updated dependencies [157089a]
- Updated dependencies [5d54fb4]
- Updated dependencies [14d7d42]
- Updated dependencies [8aa72a1]
- Updated dependencies [f141c18]
- Updated dependencies [8c1acbd]
- Updated dependencies [99da854]
- Updated dependencies [76e734f]
- Updated dependencies [4c9b8a1]
  - @croco/framework-context@0.1.0
  - @croco/features-core@0.0.5
  - @croco/integrations-posthog@0.1.0

## 0.0.4

### Patch Changes

- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [d281518]
- Updated dependencies [ee924c0]
- Updated dependencies [5403360]
- Updated dependencies [e12e825]
- Updated dependencies [6831875]
- Updated dependencies [a61dcd4]
- Updated dependencies [4c7fcd9]
- Updated dependencies [1dc1607]
- Updated dependencies [d707a0c]
- Updated dependencies [9c2ac20]
- Updated dependencies [de7610e]
- Updated dependencies [14bd9f8]
- Updated dependencies [0618b12]
- Updated dependencies [41ee87a]
- Updated dependencies [c54e7b5]
- Updated dependencies [d1552a5]
  - @croco/features-core@0.0.4
  - @croco/integrations-posthog@0.0.4
  - @croco/framework-context@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/framework-context@0.0.3
  - @croco/features-core@0.0.3
  - @croco/integrations-posthog@0.0.3
