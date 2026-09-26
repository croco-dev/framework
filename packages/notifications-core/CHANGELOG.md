# @croco/notifications-core

## 0.2.0

### Minor Changes

- 7b92cd4: Notification providers now return structurally coherent delivery results: successful outcomes may carry delivery
  evidence, while failures must carry a Croco Problem that drives retry classification. The Resend adapter normalizes
  all provider failures into that Problem contract before returning, replacing the legacy failure `error` field with
  `problem`. Task execution now preserves retryability declared by Croco Problem extensions.
- 00ac668: Require every notification provider to declare its template, idempotency, channel, and outbox capabilities,
  reject contradictory profiles at registration with stable Problems, and preserve the validated profile for
  dispatch and diagnostics. External `NotificationProvider` implementations must add `getCapabilities()` and
  choose every capability value explicitly; no inferred compatibility profile remains.

  Resend and application test providers can verify the same capability contract through the shared notification
  provider conformance suite. The Problems registry now publishes the stable missing-profile, provider-name
  mismatch, and provider-channel mismatch notification codes.

- 9b96858: Resolve tenant-scoped recipients and dispatch typed engagement messages with deterministic execution identities and explicit suppression outcomes.

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

- 96b6b80: Require email invitation creation idempotency keys and keep invitations non-accepting until claimed event and notification phases complete, so acknowledgement loss, retries, and concurrent requests reuse one invitation and token without exposing contradictory pending state. Replay tokens are application-encrypted in Drizzle, and notification delivery can now require provider-level idempotency support. Custom invitation stores must implement the new atomic creation, claim, activation, and cleanup methods; Drizzle consumers must apply the included creation-intent migration and configure a token cipher before deploying.
- 67e0cbe: fix: resolve published package types before runtime conditions
- 44c28fe: Preserve plain-text notification subjects and non-email template variables while retaining HTML escaping for email content.
- 1c843a5: Preserve runtime class-decorator metadata in published ESM and CJS bundles so Croco can resolve concrete constructor dependencies from installed packages.
- 5d54fb4: declare Apache-2.0 license across all publishable package manifests and ship LICENSE in published packages
- 86fd75d: Allow template placeholders declared as optional to be omitted and render their missing values as empty strings.
- 918a960: Reject Problem extensions that could override core fields or fail JSON serialization while preserving nested JSON-safe data. Problem evidence is now immutable after construction, and optional evidence is omitted instead of being emitted as `undefined`.

  Provider HTTP diagnostics now expose `upstreamStatus` instead of the reserved `status` extension. Invitation state uses `invitationStatus`, outbound webhook state uses `deliveryStatus`, and runtime contract mismatch evidence uses `baselineCanonical` and `actualCanonical` instead of `baseline` and `actual`. Consumers that inspect these diagnostic extensions must migrate to the new field names.

- Updated dependencies [f74f7d9]
- Updated dependencies [4ca14ab]
- Updated dependencies [38cba9c]
- Updated dependencies [b278729]
- Updated dependencies [7008727]
- Updated dependencies [6795b4d]
- Updated dependencies [fe51253]
- Updated dependencies [c3de6cc]
- Updated dependencies [868ea09]
- Updated dependencies [c1d0ed0]
- Updated dependencies [d7b2bde]
- Updated dependencies [319d43e]
- Updated dependencies [269d9df]
- Updated dependencies [1380ce5]
- Updated dependencies [64af41f]
- Updated dependencies [7cdfcae]
- Updated dependencies [c91a72b]
- Updated dependencies [30bad55]
- Updated dependencies [121b830]
- Updated dependencies [0e658fc]
- Updated dependencies [34b6c3d]
- Updated dependencies [cb61f2e]
- Updated dependencies [13cfab4]
- Updated dependencies [f05e38e]
- Updated dependencies [ade3461]
- Updated dependencies [e9e2d49]
- Updated dependencies [d0ed66c]
- Updated dependencies [9404839]
- Updated dependencies [2d74ff8]
- Updated dependencies [b07ae3a]
- Updated dependencies [5d08b1b]
- Updated dependencies [99ace13]
- Updated dependencies [08cfa9b]
- Updated dependencies [1084825]
- Updated dependencies [dda0a50]
- Updated dependencies [3434d4b]
- Updated dependencies [fb1faf9]
- Updated dependencies [26f4b9e]
- Updated dependencies [88c6ce1]
- Updated dependencies [7c632bb]
- Updated dependencies [772a244]
- Updated dependencies [2bbb09f]
- Updated dependencies [1d12013]
- Updated dependencies [50c8c7d]
- Updated dependencies [939af32]
- Updated dependencies [7dc3a10]
- Updated dependencies [3853d82]
- Updated dependencies [935d29f]
- Updated dependencies [583588d]
- Updated dependencies [da978b0]
- Updated dependencies [718ee7d]
- Updated dependencies [f438532]
- Updated dependencies [527475f]
- Updated dependencies [b9c981a]
- Updated dependencies [2cc5438]
- Updated dependencies [0b5a8fa]
- Updated dependencies [c008825]
- Updated dependencies [98fcaed]
- Updated dependencies [f647df2]
- Updated dependencies [7b92cd4]
- Updated dependencies [d1a03e6]
- Updated dependencies [3342494]
- Updated dependencies [77794c4]
- Updated dependencies [d99ede2]
- Updated dependencies [6a6a765]
- Updated dependencies [50db523]
- Updated dependencies [7df16bb]
- Updated dependencies [ea742a4]
- Updated dependencies [eb8003d]
- Updated dependencies [7e46a3d]
- Updated dependencies [0fa2546]
- Updated dependencies [f8c52e7]
- Updated dependencies [077bb26]
- Updated dependencies [91e7bb6]
- Updated dependencies [008f3f0]
- Updated dependencies [0584573]
- Updated dependencies [500c048]
- Updated dependencies [c9c1c1d]
- Updated dependencies [09c48b3]
- Updated dependencies [6489abb]
- Updated dependencies [fd16580]
- Updated dependencies [2973efe]
- Updated dependencies [daef820]
- Updated dependencies [1f6522c]
- Updated dependencies [9b997bb]
- Updated dependencies [6d81e46]
- Updated dependencies [ec75eb4]
- Updated dependencies [101a7f1]
- Updated dependencies [82a10b8]
- Updated dependencies [7aabe26]
- Updated dependencies [1b39af2]
- Updated dependencies [dda0a50]
- Updated dependencies [15e39cc]
- Updated dependencies [03ea9aa]
- Updated dependencies [7d248c5]
- Updated dependencies [00ac668]
- Updated dependencies [9b379dd]
- Updated dependencies [ba1974d]
- Updated dependencies [bef753f]
- Updated dependencies [04ea69c]
- Updated dependencies [558c255]
- Updated dependencies [96b6b80]
- Updated dependencies [8522b0c]
- Updated dependencies [be7408f]
- Updated dependencies [969d87e]
- Updated dependencies [6fa6843]
- Updated dependencies [6069742]
- Updated dependencies [7d9c92b]
- Updated dependencies [210015b]
- Updated dependencies [16cc286]
- Updated dependencies [1255323]
- Updated dependencies [1216b88]
- Updated dependencies [0d662c6]
- Updated dependencies [b91d384]
- Updated dependencies [ba6ba75]
- Updated dependencies [05c9c45]
- Updated dependencies [76be188]
- Updated dependencies [fd6ba57]
- Updated dependencies [2bcfa27]
- Updated dependencies [d52f81f]
- Updated dependencies [b228e78]
- Updated dependencies [eed5e70]
- Updated dependencies [10f3601]
- Updated dependencies [bf62995]
- Updated dependencies [5dac3cc]
- Updated dependencies [3bb5093]
- Updated dependencies [6f8080b]
- Updated dependencies [1f3aeb7]
- Updated dependencies [e039e2d]
- Updated dependencies [c30879a]
- Updated dependencies [26bcc38]
- Updated dependencies [cfdc20a]
- Updated dependencies [0b5e89b]
- Updated dependencies [3d9e585]
- Updated dependencies [37dab98]
- Updated dependencies [00ec1c5]
- Updated dependencies [225e48a]
- Updated dependencies [a4a5a49]
- Updated dependencies [9a03a84]
- Updated dependencies [67e0cbe]
- Updated dependencies [163b65c]
- Updated dependencies [e3bb85e]
- Updated dependencies [fb10b5f]
- Updated dependencies [a7df589]
- Updated dependencies [8c2b316]
- Updated dependencies [986ce2d]
- Updated dependencies [8630cf3]
- Updated dependencies [31636bb]
- Updated dependencies [f92404b]
- Updated dependencies [44fb02d]
- Updated dependencies [1c843a5]
- Updated dependencies [45882f1]
- Updated dependencies [a8d733b]
- Updated dependencies [2a6e12c]
- Updated dependencies [f0c328e]
- Updated dependencies [2575136]
- Updated dependencies [6bac6de]
- Updated dependencies [796290f]
- Updated dependencies [c5a4e6d]
- Updated dependencies [efb33f9]
- Updated dependencies [157089a]
- Updated dependencies [47b942b]
- Updated dependencies [a458c5c]
- Updated dependencies [3ae15ed]
- Updated dependencies [5d54fb4]
- Updated dependencies [5e886a9]
- Updated dependencies [19bdcd1]
- Updated dependencies [16ff048]
- Updated dependencies [3f99747]
- Updated dependencies [6aaafc8]
- Updated dependencies [badfb5c]
- Updated dependencies [a2353be]
- Updated dependencies [affa795]
- Updated dependencies [72fbcd0]
- Updated dependencies [fb810a9]
- Updated dependencies [c7299d2]
- Updated dependencies [0530556]
- Updated dependencies [350833d]
- Updated dependencies [049b25e]
- Updated dependencies [1884ceb]
- Updated dependencies [7328ec4]
- Updated dependencies [d77aedc]
- Updated dependencies [92f606b]
- Updated dependencies [b07fb90]
- Updated dependencies [56f440b]
- Updated dependencies [f5503fd]
- Updated dependencies [e4bfcb2]
- Updated dependencies [c57ba6e]
- Updated dependencies [4505d13]
- Updated dependencies [f24f196]
- Updated dependencies [cc8106d]
- Updated dependencies [ce1a95b]
- Updated dependencies [f32c7f8]
- Updated dependencies [753b3cd]
- Updated dependencies [ab51ace]
- Updated dependencies [1e313a1]
- Updated dependencies [c11a9b4]
- Updated dependencies [8aa72a1]
- Updated dependencies [2678364]
- Updated dependencies [037c3c4]
- Updated dependencies [5e64d94]
- Updated dependencies [344995f]
- Updated dependencies [c0c9679]
- Updated dependencies [286a5ad]
- Updated dependencies [918a960]
- Updated dependencies [44c16c9]
- Updated dependencies [f141c18]
- Updated dependencies [7f7ccee]
- Updated dependencies [25bfb06]
- Updated dependencies [5feb5b8]
- Updated dependencies [f0f20c2]
- Updated dependencies [605d41d]
- Updated dependencies [6234fdf]
- Updated dependencies [115ed96]
- Updated dependencies [952f2f0]
- Updated dependencies [63a4f8a]
- Updated dependencies [2742cbc]
- Updated dependencies [555d5fe]
- Updated dependencies [95cedd9]
- Updated dependencies [847ecbf]
- Updated dependencies [bd95a2c]
- Updated dependencies [422326b]
- Updated dependencies [6f3c5b4]
- Updated dependencies [9163f70]
- Updated dependencies [fa8eea4]
- Updated dependencies [be64cc8]
- Updated dependencies [ae4a089]
- Updated dependencies [ac94fc6]
- Updated dependencies [3a9e51d]
- Updated dependencies [0026f76]
- Updated dependencies [bc3cb67]
- Updated dependencies [2c68e9c]
- Updated dependencies [7c7fbde]
- Updated dependencies [86eb935]
- Updated dependencies [fccf65b]
- Updated dependencies [65f3fdc]
- Updated dependencies [3cca753]
- Updated dependencies [28c3ab5]
- Updated dependencies [dc6c9bc]
- Updated dependencies [97ba64a]
- Updated dependencies [6542499]
- Updated dependencies [d808f9d]
- Updated dependencies [51d2d51]
- Updated dependencies [7b1505b]
- Updated dependencies [b0eb7c7]
- Updated dependencies [8c1acbd]
- Updated dependencies [683bd47]
- Updated dependencies [99da854]
- Updated dependencies [c80ce21]
- Updated dependencies [589087a]
- Updated dependencies [b8fdd47]
- Updated dependencies [9b96858]
- Updated dependencies [d2539a0]
- Updated dependencies [b242060]
- Updated dependencies [1b201e5]
- Updated dependencies [713cf3b]
- Updated dependencies [8a1dad8]
- Updated dependencies [3bd0a5a]
- Updated dependencies [5cea794]
- Updated dependencies [abb5e10]
- Updated dependencies [57b786f]
- Updated dependencies [facdc89]
- Updated dependencies [87e0994]
- Updated dependencies [87a375e]
- Updated dependencies [3f61772]
- Updated dependencies [4afb5cf]
- Updated dependencies [62885fe]
- Updated dependencies [525847a]
- Updated dependencies [b65ed66]
- Updated dependencies [76e734f]
- Updated dependencies [7e88b45]
- Updated dependencies [9123362]
- Updated dependencies [70fd27f]
- Updated dependencies [8e19e13]
- Updated dependencies [6d10475]
- Updated dependencies [0e0a46c]
- Updated dependencies [a144d94]
- Updated dependencies [ed75f31]
- Updated dependencies [973b270]
- Updated dependencies [913c441]
- Updated dependencies [377c684]
  - @croco/events-core@0.1.0
  - @croco/framework-context@0.1.0
  - @croco/problems-core@1.0.0
  - @croco/telemetry-api@0.1.1
  - @croco/execution-core@0.1.0
  - @croco/tasks-core@0.1.0

## 0.1.0

### Minor Changes

- 106cae1: `@croco/notifications-core` now exposes deterministic preference evaluation, schema-validated template rendering with preview fixtures, required service-level preference/idempotency contracts, explicit dispatch/outbox metadata, and telemetry-backed delivery failure Problems.

  `@croco/notifications-resend` now declares its rendered-email dispatch capabilities.

  `@croco/invitation-core` now sends invitation notifications with explicit preference context and idempotency keys.

### Patch Changes

- d281518: - fix: close package docs coverage gaps
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [2ceb6c4]
- Updated dependencies [ee924c0]
- Updated dependencies [5403360]
- Updated dependencies [e12e825]
- Updated dependencies [6831875]
- Updated dependencies [38727f9]
- Updated dependencies [b524ca3]
- Updated dependencies [3f6dca0]
- Updated dependencies [595c786]
- Updated dependencies [3c29e42]
- Updated dependencies [a61dcd4]
- Updated dependencies [9d6ef7c]
- Updated dependencies [af9f355]
- Updated dependencies [4c7fcd9]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
- Updated dependencies [9c2ac20]
- Updated dependencies [de7610e]
- Updated dependencies [14bd9f8]
- Updated dependencies [0618b12]
- Updated dependencies [41ee87a]
- Updated dependencies [c54e7b5]
- Updated dependencies [d1552a5]
- Updated dependencies [b203ff8]
- Updated dependencies [ac9118b]
- Updated dependencies [96a8bb4]
- Updated dependencies [9187e8c]
  - @croco/events-core@0.0.4
  - @croco/framework-context@0.0.4
  - @croco/execution-core@0.0.4
  - @croco/telemetry-api@0.1.0
  - @croco/problems-core@0.0.4
  - @croco/tasks-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/events-core@0.0.3
  - @croco/framework-context@0.0.3
  - @croco/execution-core@0.0.3
  - @croco/problems-core@0.0.3
  - @croco/tasks-core@0.0.3
