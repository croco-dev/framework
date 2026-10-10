# create-croco-app

## 0.2.0

### Minor Changes

- 1b89b05: - fix: keep Node toolchain changes cache-correct
  - fix: keep split CI toolchains deterministic
  - fix: harden cacheable CI evidence boundaries
  - fix: isolate cacheable CI lane artifacts
  - fix: preserve provenance verification in split CI
  - fix: emit exact CI cache keys safely
  - feat: run cacheable verification lanes in parallel
  - feat: make split CI evidence locally verifiable
- e0c11de: Generate an opt-in Astryx Vite SPA profile with Croco-aware theme, layout, Problem, and auth states, explicit UI metadata, isolated dependencies, and install/typecheck/build/render smoke evidence.
- 64af41f: Expose position-consistent tenant credit operations with allocation evidence, permission-safe
  references, audited append-only adjustments, and an in-memory generated admin example.
- cb61f2e: Run bounded deterministic route-contract fuzzing and capability-aware runtime differential checks with replayable failure artifacts, including generated application smoke coverage.
- b07ae3a: Generate real-browser React component tests, fail-closed MSW API fixtures, Playwright user journeys, and sharded browser CI evidence for production and admin application starters, with the generated frontend failure registered in the shared Problem catalog.
- 6857733: Generated projects with agent rules now include the official Croco Skill and expose it in generation results, with catalog-backed package selection and project inspection guidance.
- 3342494: Discover Croco components by TypeScript symbol identity and generate deterministic application-scoped factories, dependency manifests, and lifecycle-aware runtime graphs during server builds.

  `@Component`, `@Inject`, REST controllers, and GraphQL resolvers remain the authoring surface, but their imports no longer register services in a process-global container. Applications using custom builds must enable `crocoPlugin()` or pass a generated graph to `ApplicationRuntime`. TypeDI-specific identifiers, runtime fallback, and package dependencies are removed; dynamically computed injection tokens must migrate to concrete class types, statically referenced Croco tokens, or explicit module/plugin factories.

  Business services now receive optional collaborators and loggers through constructors or function options instead of process-global container lookups. Provider inheritance is rejected by the first compiler schema; declare injected constructors and properties directly on the decorated provider. Static `di.bindings` selects token implementations, while `di.modules` defines provider ownership and import/export visibility before generated code is emitted.

  `@Auditable` now requires a receiver dependency selector and `AuditInterceptor` receives its logger through its constructor. `@BatchLoad` requires a receiver factory selector, and `@BlockDuringImpersonation` requires a receiver configuration selector. Inject these collaborators into the owning instance and pass an accessor to the decorator; process-global lookup and missing-provider fallback are no longer supported. `registerBatchLoaderFactory()` is removed; construct or inject `BatchLoaderFactory` into the repository instead.

  RLS adapters with `debug: true` now require an explicitly supplied logger; they no longer resolve one from the process-global container.

  `@Metered` accepts an explicit logger option instead of resolving one globally. Without a reporter, local metering failures propagate rather than being silently ignored; billing-required failures remain fail-closed.

  PostHog configuration is now validated with `createPostHogConfig()` and passed to an application-owned provider; `registerPostHogConfig()` no longer writes to a process-global container.

  Transaction managers are now held by an application-owned `TxManagerRegistry` instance, and `@Transactional` receives a manager selector for its service instance. `EventPublisher` receives its transaction context explicitly for after-commit publication; neither path resolves a process-global transaction service.

  Event subscriptions resolve class handlers through an explicitly supplied resolver; a subscription may also provide its handler directly. In-memory event buses, task runners, and QStash trigger handlers no longer read handlers or loggers from a process-global container. Supply the resolver and other collaborators at the application boundary; missing required class resolution now fails explicitly.

- fd16580: Generated applications now call tenant-scoped vendor SDK clients through an application-owned text-generation function, preserve provider results and usage receipts across downstream delivery failures, and refuse automatic re-inference when provider acceptance is unknown.

  Replace the retired generic LLM engine, model registry, decorators, provider facade, and provider conformance helper with `@croco/ai-usage` for SDK-independent token, pricing, quota, event, and telemetry ingestion. Existing `llm.*` meter identifiers remain unchanged for stored-usage compatibility.

  `MeteringService.getRecordStatus` exposes missing, active, retryable, persistence-uncertain, delivery-pending, rejected, and completed states so receipt recovery can replay idempotent persistence and resume persisted deliveries without reapplying quota or treating quota rejection as a successful charge.

  Problem code migration:
  - Replace `llm-metering/cost-limit-exceeded`, `llm-metering/pricing-not-found`, `llm-metering/pricing-registry-conflict`, `llm-metering/quota-exceeded`, and `llm-metering/record-failed` with their `ai-usage/*` equivalents.
  - Remove branches for `ai-saas/model-not-found`, `EMBEDDING_ERROR`, `GENERATION_ERROR`, `LLM_PROVIDER_NOT_FOUND`, `LLM_SERVICE_ERROR`, `MODEL_NOT_FOUND`, `STRUCTURED_OUTPUT_ERROR`, `TOKEN_LIMIT_EXCEEDED`, and `TOOL_EXECUTION_ERROR`; feature code now validates its own SDK call contract.
  - Remove branches for `llm-core/completion-event-publication-failed`, `llm-core/invalid-llm-prompt`, `llm-core/invalid-llm-response`, `llm-core/llm-service-not-initialized`, `llm-core/operation-aborted`, and `llm-core/rate-limit-exceeded`; there is no framework engine replacement.
  - Remove branches for `llm-metering/service-required`; applications inject `AiUsageIngestService` explicitly.
  - Remove branches for `llm-openai/aborted`, `llm-openai/authentication-failed`, `llm-openai/invalid-response`, `llm-openai/missing-config`, `llm-openai/rate-limited`, `llm-openai/retryable-upstream`, `llm-openai/terminal-upstream`, and `llm-openai/validation-failed`; map vendor SDK failures at the feature boundary.

- 7aabe26: Add Customer 360 and campaign delivery operations contracts, accessible console panels, admin-ops timeline and retry console adapters, and generated app example.
- dda0a50: Generate the Node/Postgres SaaS profile as an executable canonical plugin graph, run the selected graph at application bootstrap, release its application-owned PostgreSQL pool through canonical module shutdown, and expose explicit production, local replacement, unavailable, and documentation-only capability states.

  Register stable Problem codes for provider-profile mismatches and unavailable runtimes.

- bc338cc: The Next.js-hosted tRPC fullstack scaffold includes a local SSR product journey with server-authenticated private briefs, SQLite command persistence and committed event correlation. Local test identities require explicit activation; production authentication and the separate warehouse data add-on remain unsupported by this example.
- 0d662c6: Generated applications now require Node.js 24. Generated manifests declare `engines.node: ">=24"`, the generated
  `.nvmrc` pins `24`, workspaces pin `pnpm@12.7.0`, Docker templates build on `node:24-slim`, bundles target `node24`,
  and templates depend on `@types/node` `^24`. SaaS presets no longer carry a separate Node.js 22.5 floor.
  `create-croco-app` rejects Node.js 22 and 23 with `create-croco-app/unsupported-node-version` before writing files,
  and the Problem registry recovery guidance now names Node.js 24. Cloudflare meta-vite fullstack workspaces now include
  `libs/**/*`, so the generated shared libraries install their own dependencies instead of relying on binaries that pnpm
  11 exposed from sibling workspace packages.
- ebfa293: Generate a commented, capability-specific `.env.example` for every scaffold without creating a real `.env` file or emitting provider credentials.
- 3d9e585: Expose version-aware lifecycle automation operations, redacted dry-run evidence, run diagnosis, and audited controls in admin React surfaces and the generated admin console.
- 8c2b316: Subscriptions now pin an explicit immutable plan version, historical pricing returns identified
  versions, and Polar webhooks reject unknown product and price mappings before persistence.

  Existing subscription records require an explicitly selected matching version reference; migration
  never falls back to the latest published version.

- fcb2c3c: - fix: generate projects whose validation path runs without a POSIX compatibility shell
  - fix: load controller contract graphs from Windows drive paths without collapsing the TypeScript rootDir
  - fix: load OpenAPI contract sources from Windows drive paths without collapsing the TypeScript rootDir
  - change: expose machine-readable next steps as structured command, argument, and working-directory data
- a458c5c: Generate a deterministic SaaS metered-overage path with durable provider delivery, duplicate acknowledgement, version-pinned entitlement evidence, billing drift diagnostics, and deployment-time monetization contract canaries.
- f24f196: Provide a runner-neutral ScenarioRuntime for ordered, replayable application failure timelines with virtual time, boundary-level injection, multiplicity assertions, and stable versioned reports. Generated SaaS apps now extend their existing operational catalog with an app-backed checkout commit, response-loss, and idempotent-retry scenario.
- 600c5e1: Expose an accessible monetization plan review and publication console with exact draft-review evidence, structured catalog-bound editing, semantic change and impact views, safe publish confirmations, and a generated fake-provider workflow.
- a21297b: Publish side-effect-free root and programmatic entrypoints while keeping CLI execution in the binary.
- 0026f76: Return canonical generation artifacts, resolved configuration, post-action status, and next commands from the public programmatic generator.
- 3aec14e: Registered attribute and event conditions can be previewed and published as versioned cohort audiences for campaigns.
- dae5f9c: Expose separate raw, normalized, and resolved generation option contracts so incompatible goal, preset, provider, hosting, deployment, and UI combinations fail at compile time while CLI input keeps its Problem-backed validation.
- 913c441: Add tenant-scoped outbound webhook operations contracts, accessible reliability views, structural timeline and retry adapters, and a generated fake-transport admin smoke.

### Patch Changes

- 5503326: Add Firebase Cloud Messaging push delivery with canonical content, bounded batch concurrency, sanitized failure classification, and explicit readiness diagnostics. Add scoped push endpoint registration, refresh, rotation, terminal invalidation, and application-triggered stale endpoint maintenance with durable delivery evidence.

  Replaying a persisted dispatch reconciles acceptance and terminal token-invalid events after a delivery-event store outage without sending the notification again. If dispatch persistence failed, notification replay can recover an endpoint-invalidating outcome from the settled task's saved failure code when the provider declares that code. Endpoint refresh preserves the latest `lastSeenAt` value when registrations overlap, and stale cleanup rechecks its cutoff when invalidating.

  Replace `PushEndpoint.token` with an opaque `tokenReference` and remove `PushTokenResolver` from `StoreBackedRecipientDirectory`. Applications must keep tokens in a vault and configure the `FcmProvider` option `resolveToken` so persisted notification jobs contain references only. FCM does not guarantee idempotency-key deduplication.

  Contact-policy dispatches retain provider acceptance and terminal token-invalid evidence independently of unknown budget acceptance. Replay validates the payload and campaign before repairing events, preserves prior dispatch evidence when eligibility changes, and never resends or releases unknown budget automatically.

- 7b6c525: Fix the non-fullstack `cloudflare-meta-vite` web template to emit an assets-only `wrangler.toml` instead of referencing the unbuilt `dist/worker-ssr/index.js` entry.
- f332473: Fix the ddd-vike-fullstack SSR worker deployment by declaring its built entry in wrangler.toml.
- 7665cbd: Registered policies can be edited, reviewed, scheduled, published, and resolved by scoped revision, with PostgreSQL persistence and an admin console using the same release contract.
- 7d6ec6b: Applications can publish scoped in-app experiences at registered placements, render the same server decision during hydration, and durably confirm visible displays and dismissals.
- e30b3e8: Applications can run versioned, tenant-scoped Journeys with durable waits, goal and policy rechecks, and bounded action dispatch. Operators can inspect episodes, preview a sample, and control future dispatch from the Journey console.
- f305867: Add code-registered promotion offers with controlled eligibility, stacking, and budget. Policies pin benefit snapshots into quotes and claims so later revisions never rewrite confirmed terms. Trial credits fulfill through the existing credit ledger adapter (server-only `@croco/promotions-core/credit-grant` subpath); discount quotes stay pure minor-unit math and never claim an unimplemented provider feature. The browser-safe root barrel depends only on problems-core so generated console-web Vite builds no longer pull node-only modules.
- eb80ac6: Add explicit referral attribution from a shared link through qualification to dual-side benefits. Programs pin benefit snapshots, conversion windows, and qualifying actions; the first valid claim for a recipient inside a program family wins, and later claims are held as duplicates. Qualification and novelty come from authoritative app-owned server sources, never from client assertions or IP/device similarity. Benefits fulfill per side with deterministic idempotency keys, so one side may succeed while the other stays pending without re-paying the completed side on retry. Trial credits fulfill through the existing credit ledger adapter (server-only `@croco/referral-core/credit-grant` subpath) with an explicit account-mapping resolver; link tokens are issued via `@croco/referral-core/link-token` with hash-only persistence. The browser-safe root barrel depends only on problems-core so generated console-web Vite builds no longer pull node-only modules.
- a097a50: Applications can declare transaction facts and sparse aggregates with validated grain, time, scope, and write policies, then compile portable descriptors and import bounded fixtures.
- bb084c1: Reject web app names that collide with the standalone API app directory before generation.
- 160e352: - fix(ci): make core coverage independent of affected builds
- 38cba9c: - fix: enforce full strict contract spine
- b278729: - fix: block critical test tooling advisories
- 28bd12e: Coding agents can read authorized definitions, registered queries, reviewed reports, and workspace source references through CLI JSON and local stdio MCP. Shared reads accept invocation cancellation and distinguish timeouts; query discovery exposes authorized metadata without execution functions. The Croco Skill includes the standalone read workflow and its unsupported provider boundaries.
- 868ea09: Let each Croco application own one isolated DI scope and module lifecycle, retry failed startup from
  the exact pre-attempt provider baseline, inspect one correlated module and dependency graph, and run
  TestKernel without process-global container resets.
  Canonical SaaS templates now bind HTTP application calls to their application-owned runtime, and
  scoped HTTP bootstrap validation ignores unrelated process-global component registrations.
- c1d0ed0: - feat: verify public behavior contracts against executable test evidence
  - test: report generated SaaS bootstrap fidelity against its public route obligations
- 269d9df: Execution stores now merge individual checkpoint keys atomically as part of their required contract. Concurrent writes to different keys are preserved. Same-key writes are serialized by the store with the last applied mutation winning, without an invocation-order guarantee.
- 7cdfcae: Declare audited package side effects so bundlers remove pure imports while preserving required initialization and CSS.
- c91a72b: Verify AuthGuard conformance with explicit provider-unavailable Problems, generated REST/GraphQL protected-route smoke coverage, and a patched Better Auth provider dependency.
- 4859f6a: Billable usage records complete when replayed after the delivery worker has already claimed or accepted the journal entry.
- 3b99ee8: Customers can cancel directly or choose a supported registered retention action against an
  authorized subscription and authoritative refund quote. PostgreSQL preserves sessions, policy
  audits and existing billing lifecycle commands across retries and restarts. Customer and operator
  views distinguish cancellation scheduling, confirmed termination and independently confirmed refunds.
- 2d74ff8: Bound concurrent telemetry shutdown calls, let timed-out callers rejoin the same teardown, safely reinitialize only after OpenTelemetry global state is released, and keep generated operational failure drills explicit about their telemetry lifecycle.
- a125d51: - Generated app templates now use runtime dependency versions that satisfy the dependency audit policy.
- 88c6ce1: Metering retries now resume an explicit pending-event stage, preserve logical event identities, and recover publication
  failures without recording usage twice.

  Custom `UsageStorage` implementations must declare `replayContract: "idempotent"` and replay the original quota result
  for a repeated idempotency key. Redis clients must explicitly declare multi-key script support.

- 7dc3a10: Generate SaaS presets with one module-owned composition root shared by runtime bootstrap, graph verification, and AI extensions, and recognize its HTTP security contributions in `croco doctor`.
- 4efd9d3: Generated application architecture guidance and policy use canonical package roles and distinguish plugin subtypes from dependency layers.
- 0590a47: Make the public `saas-api` scaffold journey executable through the real CLI contract and verify its generated zero-credential demo smoke.
- 583588d: Generated Drizzle dependencies now follow the workspace catalog range across DDD and SaaS scaffolds.
- 34114fd: Confirmed outbox events can be validated as ETL sources and accepted as durable warehouse facts without changing the domain transaction's result. Analytics inbox acknowledgement follows a durable fact receipt or quarantine record; exact-ID replay reports unavailable retained history, and in-memory outbox claims preserve aggregate order.
- 50db523: Make access decisions authoritative and statically consistent: allow results always carry
  `allowed: true`, while deny and abstain results always carry `allowed: false` across the engine,
  Drizzle provider, guards, and generated SaaS provider.
- dd17225: Reject unsafe, reserved, empty, or duplicate web app names before generated workspace files are created.
- 7df16bb: Register REST controllers with the DI container automatically while preserving explicit component scopes.
  Generated applications now use `@Controller` as the single controller registration convention.
- 014e7dd: Consenting tenant members can join cooperative challenges, contribute verified activity within participation intervals and per-member caps, and leave under an explicit retention policy. PostgreSQL transactions preserve one final settlement and completion intent across concurrent contributions and retries. Participant controls and the operator console share the challenge service and expose aggregate progress without private activity.

  Generated app package-role metadata includes the cooperative challenge packages.

- 9ed442c: Explore fixed customer samples through scoped, paginated timelines and audited fact or hypothesis notes, with PostgreSQL persistence in the dedicated `@croco/admin-postgres` provider package and a standalone React workspace.
- cbf0dd8: Keep generated admin console credit smoke fixtures deterministic by evaluating ledger operations with the fixture clock.
- 0fa2546: Generate deterministic DI graph manifests through the CLI and generated app verification scripts.
- 6489abb: Expose a shared versioned application intent contract and make `croco doctor` report malformed, unsupported, or workspace-drifted `croco.app.json` manifests while custom workspaces remain explicitly skipped.
- 1f6522c: Persist subscription cancel and resume commands before provider I/O, carry stable provider idempotency keys,
  use revision-fenced local reconciliation, durably retry cancellation event delivery through an
  event-ID-idempotent publisher contract, expose bounded
  reconciliation APIs, and project provider-applied lifecycle state into entitlement reads until local state
  converges.

  Stale commands cannot overwrite replacement subscriptions, while lifecycle deltas rebase onto newer snapshots
  of the same external subscription and persist their local outcome. Canceled or revoked subscriptions no longer
  grant a current entitlement plan. Polar lifecycle mutations now forward command keys and verify already-applied
  cancellation targets, while the billing provider conformance suite requires distinct lifecycle idempotency
  evidence.

  The generated SaaS demo leaves lifecycle event delivery unconfigured until an application supplies a durable,
  event-ID-idempotent publisher.

- 2cb8210: Persist credit ledger event intents atomically with committed movements, recover them across restarts without repeating balances, and require volatile delivery to be selected explicitly for development.
- 63a4f8a: Generated applications now declare the supported Node.js train, include an `.nvmrc`, document recovery for unsupported versions, reject generation before writing files when the active Node.js version is too old, and keep Astryx server-rendering smoke checks runnable on that train.
- 5d620c2: Server-verified achievements can grant separate non-transferable points and unique badges through immutable reward policies, durable selection receipts, scoped deduplication, and bounded depletion fallbacks. Operators can publish audited policies and customers can view earned rewards and receipts.
- 743a99d: Generated applications now keep DI bootstrap validation enabled so missing providers surface during startup with actionable diagnostics.
- 7d248c5: Expose host, transport, and build-target composition as separate runtime metadata, bind host callbacks
  to their owning application scope, preserve the legacy Cloudflare handler context, and teach generated
  apps and presentation adapters to use explicit host and build-target entry points. Generated Lambda and
  Cloudflare SaaS apps now advertise commands that validate their actual deployment targets, including a
  Wrangler configuration with explicit Node.js compatibility for the generated Worker composition. Raw
  Hono callbacks must explicitly select raw-Hono dispatch when using the canonical Cloudflare host.

  Generated SaaS hosts await provider initialization and leave telemetry shutdown to the application
  runtime. Lambda and Workers host artifacts do not enable their documentation-only SaaS provider
  composition; invoking those profiles still reports `CROCO_SAAS_PROFILE_RUNTIME_UNAVAILABLE`.

- bef753f: Store customer fact projections with separate source and row identities, reconstruct values at effective and known times, and inspect provenance and corrections from the admin panel.
- 8522b0c: Keep default package tests deterministic while exposing integration, published-package, and live-resource verification through explicit test lanes.
- be7408f: Expose fatal logging through the shared `ILogger` and `LOGGER_TOKEN` contract, including child loggers and Error context,
  while keeping generated bootstrap and built-in no-op loggers contract-complete.
- a2cbc84: Generated Croco skill guidance includes the working first-party plugin composition start command.
- 623c255: Require Handlebars 4.7.10 or later to include fixes for template compilation vulnerabilities.
- b3f4743: New production app, admin console, and default or single tenant SaaS scaffolds ship contract baselines and generated outputs, so their first contract verification and API server tests pass without a bootstrap step.
- 5e8f35d: Pin generated workspaces to the supported Turbo release and verify their new lockfiles against frozen CI installation.
- a6fadf7: Expose the generated app Croco compatibility train version set so generated dependency ranges can be audited by package quality gates.
- 0f57173: Generated production and admin browser workflows now reject stale contract artifacts before running browser tests instead of regenerating and hiding drift.
- f5ddd0a: Split generated-app smoke evidence into spine-blocking and ecosystem-advisory matrices, with release evidence pinned to the spine tier.
- 1422996: Keep generated-app range checks aligned with the current Croco package versions.
- bc58c8b: - fix(create-croco-app): keep every goal scaffold installable and verifiable
- f04c4cd: Generated GraphQL APIs redact Problem details and extensions and mask unexpected resolver errors across standalone, Lambda, and Next.js hosting.
- 4979cc6: Generated application guidance describes compiler-owned wiring and the current growth/data contracts separately from planned integration.
- 76be188: Expose optional, required, and parser-validated page data hooks so missing or unvalidated hydration data is explicit at each call site.
- bf62995: Require stable checkout idempotency keys, coalesce concurrent equivalent tenant requests, replay completed results from a durable idempotency store, reject reused keys with different checkout inputs, and reconcile Polar sessions through provider operation metadata.
- 0b5e89b: Make bulk repository reads return explicit keyed partial results, and reject duplicate, unexpected, unkeyed, or identity-mismatched batch entries before they can be assigned to callers.

  Custom `ReadRepository` and `AbstractDrizzleRepository` implementations must return `{ key, value }` entries from `findByIds`; omit entries for missing IDs.

- b8f4a48: Document that native Windows CLI and scaffold development is outside the supported beta scope, with WSL2 as an unverified Linux-toolchain alternative. Generated apps retain their Linux verification path.
- 38d1957: Generated Next.js Docker frontends build a standalone server with the public assets required by their Dockerfile.
- 4a5ed43: Fix vite-spa + docker single-container image to serve the SPA and proxy API traffic through web/gateway.mjs.
- c2d18a0: Send traces to `/v1/traces` when `OTEL_EXPORTER_OTLP_ENDPOINT` supplies a base URL, including in generated apps and Lambda presets.
- 10f7572: Use the GraphQL Yoga executor compatible with patched GraphQL Tools utilities and pin patched utilities in generated application workspaces.

  Independent consumers of `@croco/transports-graphql` need an application-root override for `@graphql-tools/utils@<=12.0.0` to `12.0.3`; repository overrides are not inherited by installed packages. Generated workspaces include this override.

- 986ce2d: Release immutable plan versions through optimistic drafts, deterministic review evidence, scheduled or immediate idempotent publication, and audit-ready lifecycle events. Keep generated DI failure coverage aligned with self-registering controllers.
- efb33f9: Boot production application definitions in isolated, runner-neutral test kernels with explicit application or adapter fidelity.

  Each kernel now owns its DI instances, event configuration, test transaction evidence, request state, scoped production shutdown hooks, and one-time cleanup lifecycle without replacing the application's production transaction provider. Node and Lambda adapter requests run through their real handler paths without opening a public network port, while the existing lightweight testing app is reported as isolated fidelity.

- 8bf1a44: Version generated SaaS provider and tenant manifests as public compatibility contracts with doctor diagnostics for unsupported manifest versions.
- 3ae15ed: Use `@croco/warehouse-postgres/metrics` for PostgreSQL and TimescaleDB metrics persistence. `metrics-core` now exposes only provider-neutral metric contracts and calculations; applications must replace `TimescaleMetricsStore` with `PostgresMetricsStore` and run the explicit schema path for their database.
- 0717955: Remove stale generator-owned RPC client files after successful regeneration while preserving unrelated output-directory contents, and seed new generated apps with explicit RPC output ownership.
- 5d54fb4: declare Apache-2.0 license across all publishable package manifests and ship LICENSE in published packages
- cfe0d14: Generated browser-test workflows now restrict the GitHub token to read-only repository contents and prevent checkout credentials from persisting.
- 72fbcd0: Detect stale committed OpenAPI and RPC outputs without rewriting them, make generated app contract verification use the read-only checks, and scaffold Next.js applications with the patched 15.5.21 release.
- 63af081: - fix: keep generated application verification commands read-only
- aa51dce: Persist quota-rejected Redis usage exactly once when the same idempotency key is retried after over-quota recording becomes allowed, preserve recoverable billing intents until that retry succeeds, and continue to replay legacy deduplication markers.
- 63ee9fc: Provide recurring missions for verified value actions with scoped, versioned progress, local-calendar activity counting, durable correction and completion receipts, and shared personal progress and operator components. PostgreSQL deployments apply the explicit mission migration before constructing the store; existing one-time onboarding behavior is unchanged.
- c57ba6e: Remove the unreleased desktop contract and bridge-generation surface from Croco. The legacy
  `croco desktop` entry point now fails with `CROCO_DESKTOP_REMOVED`, points desktop-beta users to the
  last supporting repository revision, and never substitutes a web scaffold. Historical desktop
  Problem codes remain registered as deprecated diagnostics without replacements. Generated SaaS
  apps now execute native package-manager binaries directly during usage recovery.
- 753b3cd: Keep scaffold destinations untouched until generation, Git initialization, dependency installation, and lockfile validation succeed, report machine-readable retry commands after failures, and keep the generated Problem registry synchronized with the new scaffold failure locations.
- 5575357: Use runtime-aware trusted client identity when building rate limit keys.
- dbf8f27: Generate the SaaS API server DI graph before declaration builds so a newly installed scaffold can build or test without running typecheck first.
- e14e5d2: Generated SaaS apps now include a rerunnable golden-path scenario that verifies seeded dashboard state and emits CI smoke artifacts.
- 2678364: Generated AI SaaS applications retain provider Error causes for diagnostics and normalize non-Error failures without exposing provider content in public Problems. The Problem registry points to the current source location for AI smoke failures.
- 87a19e1: Generate Next.js applications with a Sharp release that excludes the inherited libvips vulnerabilities covered by GHSA-f88m-g3jw-g9cj.
- 3a46a78: Generated SaaS apps now use checked Croco secret/config placeholders in provider env examples and docs.
  Auth Better Auth now resolves a patched Better Auth runtime dependency.
- f16ed23: Generated applications now pin PostCSS 8.5.18 so newly created workspaces avoid the source-map path-traversal
  advisory.
- e07a323: Meta-Vite and generated Meta-Vite applications now require Vite `>=6.4.3 <7`, excluding the Windows
  development-server filesystem deny bypass fixed in Vite 6.4.3.
- e4bfcb2: Generate Next.js applications with patched Next.js and PostCSS releases that reject the Server Actions and
  source-map file disclosure vulnerabilities tracked by `GHSA-m99w-x7hq-7vfj` and `GHSA-6g55-p6wh-862q`.
- 6f3c5b4: Require link invitation and resend commands to carry an idempotency key so retries preserve one token and event identity after delivery failures. Drizzle deployments must apply the exported creation-intent migration and configure a 32-byte invitation token-cipher key before upgrading.
- f36a6c1: Generated standalone GraphQL and tRPC projects with Next.js web apps pass typecheck and build after installation.
- 4b20808: Generated SaaS apps now verify eight operational failure boundaries and retain deterministic JSON and Markdown recovery evidence for release gates.
- 01ed4e5: Decode bounded CSV and JSONL byte streams into schema-validated source rows with precise location errors, and recognize the new contracts package in scaffold metadata without requiring a warehouse or worker runtime.
- fa8eea4: Generated OpenAPI and RPC contract paths now run strict ContractGraph schema checks by default, fail generated app scripts on strict ContractGraph diagnostics, and keep legacy compatibility behavior behind explicit opt-out flags.
- be64cc8: Reject usage values outside the positive safe-integer range before idempotency or storage, fail closed when Redis contains an invalid or unsafe accumulated value, encode AI usage USD cost meters and generated app quotas as integer nanodollars, and widen PostgreSQL metering integers to BIGINT so every adapter preserves the same contract.
- c5fb714: Compare historical targeting filters with explicit unknown populations, observed send costs, and distinct click-only or post-send crediting scenarios. Server-authorized campaign reads and immutable report snapshots preserve missing evidence and separate historical associations from causal effects.
- f0e9c0d: Let admin applications compose an accessible Tenant 360 workspace from optional cross-domain sources while preserving partial failures, permissions, Problems, audited actions, and extension state.
- 28c3ab5: Usage flush rejects storage without deletion support and requires repositories to declare durable idempotent persistence. Custom MeterRepository implementations must enforce uniqueness for tenantId, meterId and idempotencyKey before declaring replayContract as idempotent. Retries after deletion failures preserve one persisted usage record per identity.
- b27f2e7: Skip the API type prompt for ddd-vike-fullstack and reject its unsupported --api option in CLI and programmatic options. The preset's GeneratorOptions type no longer accepts an API type; ddd-api and ddd-fullstack keep their protocol selection.
- 208952c: Resolve generated `*Result` network and cancellation failures as external results while preserving throwing client behavior, distinct telemetry events, and scaffold compatibility with unknown external errors.
- 6542499: Make membership mutations idempotent and atomically persist recoverable domain-event intents. Membership command APIs now require caller-supplied idempotency keys, expose replay state through `addMemberCommand()`, and no longer publish inside the command transaction. Durable delivery requires a persistent store, an idempotent event publisher, and a relay or worker that calls `publishPendingEvents()`.
- c934b22: tRPC Lambda projects use a Lambda-compatible request context and generated Lambda projects include only the selected API app.
- 8c1acbd: Keep committed transaction values successful when after-commit hooks fail, and expose structured degraded delivery
  evidence through `TxManager.runWithOutcome()`. Transactions that schedule after-commit work must now use this
  outcome-returning contract; invitation acceptance returns the committed transaction outcome, and event publication
  rejects non-capturing or late hook registration before delivery work can disappear.
- 683bd47: Expose a trace-only telemetry contract by removing the unimplemented metrics and logs facades and their reserved configuration. Consumers should remove metrics and logs options and stop branching on the deprecated `TELEMETRY_SIGNAL_UNSUPPORTED` Problem code. Generated applications now emit trace-only configuration, and packed consumer coverage verifies the published trace types and the complete initialization, flush, and shutdown lifecycle.
- e826709: Report explicit completed, skipped, unsupported, and failed telemetry lifecycle outcomes, preserve initialization failures through shutdown, and make generated Lambda handlers fail when a requested flush cannot run or complete.
- 589087a: Document and verify typed audience snapshots and one-shot campaign broadcasts, including packed ESM/CJS consumers and a credential-free generated SaaS smoke path.
- a75563f: Require TypeScript 6 consumers while preserving Croco 1.x legacy decorator metadata and generated application
  compiler settings.
- f327639: Give every generated app a pinned, configured lint command and verify linting across the complete smoke matrix.
- 1cf1845: Generated web apps use their selected names in workspace packages, Cloudflare Workers, and Docker and Vercel build targets. Next.js API hosting rejects web app names other than `web`.
- Updated dependencies [5503326]
- Updated dependencies [029130d]
- Updated dependencies [839c7d0]
- Updated dependencies [87471c8]
- Updated dependencies [8bc3ca5]
- Updated dependencies [a661a90]
- Updated dependencies [d9affdf]
- Updated dependencies [edd8297]
- Updated dependencies [a6e5d99]
- Updated dependencies [d595f1a]
- Updated dependencies [7665cbd]
- Updated dependencies [7d6ec6b]
- Updated dependencies [f305867]
- Updated dependencies [eb80ac6]
- Updated dependencies [9684c00]
- Updated dependencies [66ebeeb]
- Updated dependencies [efe301f]
- Updated dependencies [93e89b7]
- Updated dependencies [ec0a465]
- Updated dependencies [66c18a7]
- Updated dependencies [85634b8]
- Updated dependencies [78f08f7]
- Updated dependencies [ef63051]
- Updated dependencies [df6771f]
- Updated dependencies [0645e1b]
- Updated dependencies [02eeb40]
- Updated dependencies [4b6e723]
- Updated dependencies [38cba9c]
- Updated dependencies [6795b4d]
- Updated dependencies [7390b1b]
- Updated dependencies [fd5f126]
- Updated dependencies [28bd12e]
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
- Updated dependencies [ba1c12d]
- Updated dependencies [dc185a0]
- Updated dependencies [0e658fc]
- Updated dependencies [34b6c3d]
- Updated dependencies [3b99ee8]
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
- Updated dependencies [24f2385]
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
- Updated dependencies [2cc5438]
- Updated dependencies [0b5a8fa]
- Updated dependencies [c008825]
- Updated dependencies [98fcaed]
- Updated dependencies [f647df2]
- Updated dependencies [d1a03e6]
- Updated dependencies [3342494]
- Updated dependencies [77794c4]
- Updated dependencies [d99ede2]
- Updated dependencies [34114fd]
- Updated dependencies [50db523]
- Updated dependencies [5fc43c0]
- Updated dependencies [7df16bb]
- Updated dependencies [014e7dd]
- Updated dependencies [ea742a4]
- Updated dependencies [eb8003d]
- Updated dependencies [7e46a3d]
- Updated dependencies [9ed442c]
- Updated dependencies [ba8b08c]
- Updated dependencies [0fa2546]
- Updated dependencies [077bb26]
- Updated dependencies [91e7bb6]
- Updated dependencies [0584573]
- Updated dependencies [500c048]
- Updated dependencies [c9c1c1d]
- Updated dependencies [543eda3]
- Updated dependencies [09c48b3]
- Updated dependencies [fd16580]
- Updated dependencies [6aeb0b0]
- Updated dependencies [2973efe]
- Updated dependencies [daef820]
- Updated dependencies [1f6522c]
- Updated dependencies [9b997bb]
- Updated dependencies [6d81e46]
- Updated dependencies [5d620c2]
- Updated dependencies [ec75eb4]
- Updated dependencies [101a7f1]
- Updated dependencies [b7f9b68]
- Updated dependencies [7aabe26]
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
- Updated dependencies [969d87e]
- Updated dependencies [6fa6843]
- Updated dependencies [6069742]
- Updated dependencies [5a16dfc]
- Updated dependencies [7d9c92b]
- Updated dependencies [148a35f]
- Updated dependencies [210015b]
- Updated dependencies [de9912a]
- Updated dependencies [1255323]
- Updated dependencies [bc338cc]
- Updated dependencies [734c41b]
- Updated dependencies [1216b88]
- Updated dependencies [0d662c6]
- Updated dependencies [b91d384]
- Updated dependencies [ba6ba75]
- Updated dependencies [1581edc]
- Updated dependencies [05c9c45]
- Updated dependencies [76be188]
- Updated dependencies [fd6ba57]
- Updated dependencies [2bcfa27]
- Updated dependencies [d52f81f]
- Updated dependencies [849f645]
- Updated dependencies [b228e78]
- Updated dependencies [eed5e70]
- Updated dependencies [10f3601]
- Updated dependencies [bf62995]
- Updated dependencies [5dac3cc]
- Updated dependencies [3bb5093]
- Updated dependencies [6f8080b]
- Updated dependencies [e039e2d]
- Updated dependencies [c30879a]
- Updated dependencies [26bcc38]
- Updated dependencies [0b5e89b]
- Updated dependencies [3d9e585]
- Updated dependencies [37dab98]
- Updated dependencies [00ec1c5]
- Updated dependencies [02b2e26]
- Updated dependencies [225e48a]
- Updated dependencies [a4a5a49]
- Updated dependencies [17c8730]
- Updated dependencies [9a03a84]
- Updated dependencies [67e0cbe]
- Updated dependencies [163b65c]
- Updated dependencies [6a60235]
- Updated dependencies [fb10b5f]
- Updated dependencies [4a15ff9]
- Updated dependencies [7340bec]
- Updated dependencies [c2d18a0]
- Updated dependencies [a7df589]
- Updated dependencies [8c2b316]
- Updated dependencies [986ce2d]
- Updated dependencies [8630cf3]
- Updated dependencies [b175b28]
- Updated dependencies [31636bb]
- Updated dependencies [f92404b]
- Updated dependencies [44fb02d]
- Updated dependencies [1c843a5]
- Updated dependencies [a8d733b]
- Updated dependencies [2a6e12c]
- Updated dependencies [796290f]
- Updated dependencies [efb33f9]
- Updated dependencies [157089a]
- Updated dependencies [47b942b]
- Updated dependencies [a458c5c]
- Updated dependencies [e1ac339]
- Updated dependencies [3ae15ed]
- Updated dependencies [5d54fb4]
- Updated dependencies [78e8e81]
- Updated dependencies [19bdcd1]
- Updated dependencies [16ff048]
- Updated dependencies [3f99747]
- Updated dependencies [02ac1bc]
- Updated dependencies [6aaafc8]
- Updated dependencies [badfb5c]
- Updated dependencies [70758b1]
- Updated dependencies [a2353be]
- Updated dependencies [affa795]
- Updated dependencies [63d0cfc]
- Updated dependencies [5584cd6]
- Updated dependencies [223bbb3]
- Updated dependencies [72fbcd0]
- Updated dependencies [fb810a9]
- Updated dependencies [c7299d2]
- Updated dependencies [0530556]
- Updated dependencies [350833d]
- Updated dependencies [63ee9fc]
- Updated dependencies [049b25e]
- Updated dependencies [1884ceb]
- Updated dependencies [7328ec4]
- Updated dependencies [d77aedc]
- Updated dependencies [92f606b]
- Updated dependencies [b07fb90]
- Updated dependencies [56f440b]
- Updated dependencies [f5503fd]
- Updated dependencies [c57ba6e]
- Updated dependencies [e9db5a8]
- Updated dependencies [4505d13]
- Updated dependencies [f24f196]
- Updated dependencies [cc8106d]
- Updated dependencies [ce1a95b]
- Updated dependencies [10fc7b4]
- Updated dependencies [753b3cd]
- Updated dependencies [ab51ace]
- Updated dependencies [1e313a1]
- Updated dependencies [26fb699]
- Updated dependencies [c11a9b4]
- Updated dependencies [2678364]
- Updated dependencies [037c3c4]
- Updated dependencies [5e64d94]
- Updated dependencies [344995f]
- Updated dependencies [c0c9679]
- Updated dependencies [286a5ad]
- Updated dependencies [918a960]
- Updated dependencies [44c16c9]
- Updated dependencies [85b2665]
- Updated dependencies [7f7ccee]
- Updated dependencies [25bfb06]
- Updated dependencies [5feb5b8]
- Updated dependencies [f0f20c2]
- Updated dependencies [605d41d]
- Updated dependencies [a34879e]
- Updated dependencies [6234fdf]
- Updated dependencies [115ed96]
- Updated dependencies [952f2f0]
- Updated dependencies [63a4f8a]
- Updated dependencies [2742cbc]
- Updated dependencies [555d5fe]
- Updated dependencies [95cedd9]
- Updated dependencies [847ecbf]
- Updated dependencies [80d86ff]
- Updated dependencies [bd95a2c]
- Updated dependencies [422326b]
- Updated dependencies [6f3c5b4]
- Updated dependencies [9163f70]
- Updated dependencies [4c5f2b6]
- Updated dependencies [01ed4e5]
- Updated dependencies [fa8eea4]
- Updated dependencies [be64cc8]
- Updated dependencies [ae4a089]
- Updated dependencies [ac94fc6]
- Updated dependencies [3a9e51d]
- Updated dependencies [0026f76]
- Updated dependencies [c5fb714]
- Updated dependencies [5165de3]
- Updated dependencies [2c68e9c]
- Updated dependencies [86eb935]
- Updated dependencies [fccf65b]
- Updated dependencies [65f3fdc]
- Updated dependencies [da7d9e0]
- Updated dependencies [3cca753]
- Updated dependencies [28c3ab5]
- Updated dependencies [df1124c]
- Updated dependencies [0197196]
- Updated dependencies [95be142]
- Updated dependencies [c1ffad6]
- Updated dependencies [97ba64a]
- Updated dependencies [6542499]
- Updated dependencies [d808f9d]
- Updated dependencies [3e2e6f7]
- Updated dependencies [51d2d51]
- Updated dependencies [7b1505b]
- Updated dependencies [b0eb7c7]
- Updated dependencies [8c1acbd]
- Updated dependencies [683bd47]
- Updated dependencies [99da854]
- Updated dependencies [e826709]
- Updated dependencies [32f9507]
- Updated dependencies [c80ce21]
- Updated dependencies [589087a]
- Updated dependencies [3aec14e]
- Updated dependencies [b8fdd47]
- Updated dependencies [9b96858]
- Updated dependencies [b242060]
- Updated dependencies [1b201e5]
- Updated dependencies [713cf3b]
- Updated dependencies [8a1dad8]
- Updated dependencies [3bd0a5a]
- Updated dependencies [abb5e10]
- Updated dependencies [405cd7d]
- Updated dependencies [facdc89]
- Updated dependencies [87e0994]
- Updated dependencies [87a375e]
- Updated dependencies [4afb5cf]
- Updated dependencies [62885fe]
- Updated dependencies [525847a]
- Updated dependencies [b65ed66]
- Updated dependencies [76e734f]
- Updated dependencies [7e88b45]
- Updated dependencies [7653376]
- Updated dependencies [70fd27f]
- Updated dependencies [8e19e13]
- Updated dependencies [6d10475]
- Updated dependencies [f090217]
- Updated dependencies [0e0a46c]
- Updated dependencies [a144d94]
- Updated dependencies [973b270]
- Updated dependencies [f486287]
- Updated dependencies [913c441]
- Updated dependencies [47c98a4]
- Updated dependencies [377c684]
  - @croco/problems-core@1.0.0
  - @croco/telemetry-sdk-node@0.1.0

## 0.1.0

### Minor Changes

- 9806f31: Add goal-first app generation with `--goal` and a generated `croco.app.json` contract.
- 87448a1: Generated SaaS apps can declare a tenant model manifest with drift-checked playbook, schema, and migration guidance.

### Patch Changes

- 9c034ef: - Keep Lambda scaffold handler targets covered for GraphQL and REST/tRPC generated apps.
- 4d8f094: - Generated REST/Lambda and Cloudflare worker apps now bootstrap with the required HTTP security middleware instead of disabling security validation.
  - Missing required HTTP security middleware now fails with `CROCO_HTTP_SECURITY_001` while preserving the previous slash-form code as `legacyCode`.
- 40cb9f1: - fix: keep generated Meta Vite configs loadable
- d281518: - fix: close package docs coverage gaps
- e9820b9: Add an admin-console starter preset with typed generated client usage, tenant-scoped admin resources, Problem-aware UI state, operations timeline, and generated-app smoke coverage.
- 61d57ce: `create-croco-app --preset ai-saas` now generates a SaaS Golden Path app with tenant-metered AI text generation, canonical LLM usage meters, redacted invocation logs, quota smoke coverage, and documented provider seams.
- 7fe26a3: Generated blank and DDD base preset projects now include first-run README guidance.
- 511a850: CLI generators now validate generated imports against target app manifests before writing files, and API-server scaffolds declare the common generator dependencies.
- 7db1d3f: Derive CLI version banners from each package manifest instead of hard-coded source strings.
- f81bcf7: `@croco/frontend-cloudflare` now has beta Worker SSR evidence for service-binding API routing, assets fallback, streaming `Response` preservation, Cloudflare RuntimeContext propagation, and deterministic failure behavior. The generated Cloudflare meta-vite fullstack profile now exports a real Worker SSR handler and smoke-tests the Worker boundary.
- 529c7fd: Contract graph snapshots now include consumer coverage reports, OpenAPI/RPC generation verifies every graph route, generated RPC clients expose route metadata, and generated app CI contract scripts write `contract-graph.coverage.json`.
- 0475520: Generated REST app templates now include a CI-oriented contract verification gate that checks snapshot drift before regenerating OpenAPI and RPC client artifacts.
- f3951f3: REST route contracts can now drive controller decorators directly through contract-aware HTTP method, parameter, body, and response helpers. Contract graphs preserve route contract identity/source locations and report drift when controller bindings or response metadata diverge from the contract. The SPA split starter template now uses contract-first REST routes for its generated OpenAPI/RPC contract path.
- 6148ed3: Expose a canonical REST contract graph with route diagnostics and add a contract check path before OpenAPI and RPC client generation.
- 988f072: Add deterministic contract graph snapshots and drift gates for contract-first release checks.
- e44988b: CLI runs now report structured diagnostics with recovery text and successful generation next-step commands, with `--json` output available for noninteractive consumers.
- 612a8f9: Render Docker turbo filters from generated package names so scaffolded Docker files target existing workspace packages.
- 7079854: Generated app scaffolds now include install/build smoke coverage and template fixes so representative GraphQL Lambda API and tRPC Next.js fullstack projects install and build successfully.
- f46f834: Generated GraphQL Lambda API scaffolds now declare the Apollo Lambda integration dependency required by the Lambda handler, keep that Lambda-only package out of non-Lambda GraphQL apps, and include scoped shared-package TypeScript configs for clean generated-project typechecks.
- 845dec4: Generated app package manifests now rewrite external `@croco/*` workspace ranges to installable published ranges before dependency installation while preserving generated app-internal workspace dependencies.
- a2ed3bf: Generated Croco apps now state and enforce pnpm for dependency installation.
- 0ee21dc: Render Handlebars placeholders in text addon files even when the template filename does not end in `.hbs`.
- f4560b0: Generated-app smoke coverage now follows the supported option matrix, and Docker frontend deploy projects emit a web Dockerfile.
- 3d92b2e: Wire SSR template routes to generated page component values and expose the page data function type used by the SSR fixture.
- 6c159a3: Validate noninteractive CLI option combinations before generating project files.
- 5e54f30: - fix: keep create app db optional in noninteractive mode
- 5403360: HTTP apps now expose a DI bootstrap validation policy that fails fast by default, with explicit warn/off migration modes for legacy unregistered providers.
- f8842d3: - Generated SaaS and AI SaaS apps now include failure drill smoke scripts backed by deterministic `@croco/testing` scenarios for Problem, recovery, telemetry, and audit evidence.
- 2e65be0: Provide a shared browser-safe Problem client runtime and let generated clients import it explicitly.
- e71cb05: Promote the React presentation integration to beta evidence with package-level page data tests and generated Meta Vite fullstack hydration smoke.
- fe0a955: Frontend Vite generated profiles now prove SPA browser builds and meta-vite generated app builds with documented optional Cloudflare peer diagnostics.
- 0b49816: Generated REST SPA templates now expose OpenAPI spec export and typed RPC client generation commands backed by declared package dependencies and smoke-test coverage, and contract loaders resolve controller imports from the generated project.
- d733641: Generated workspaces now use pnpm's supported build-script allowlist key, and the generated-app smoke matrix now publishes template coverage results as CI artifacts.
- 8d2ebae: - Remove unreachable compatibility fixtures from the shipped top-level template surface so generated smoke accountability covers every published template directory directly.
- fff8f32: GraphQL APIs can now persist deterministic SDL contract snapshots with Croco resolver metadata, and generated GraphQL apps run snapshot drift checks in their default build/typecheck path.
- d04a78e: Generated SaaS apps now prove Jobs v1 operator workflows through CLI-backed smoke coverage, including attention
  exit codes and replay inspection semantics.
- af9f355: - Expose Jobs v1 operations for listing, inspecting, logging, cancelling, and replaying executions.
  - Add `croco jobs` commands for Jobs v1 operator inspection and recovery flows.
  - Support QStash schedule sync dry-runs before applying schedule changes.
  - Make batch chunk execution completion explicit for multi-step checkpoint flows.
  - Include a smoke-tested billing sync background job in the SaaS app preset.
- 4ae3a6d: Add lifecycle rules that turn SaaS health, onboarding, billing, and usage signals into observable retention actions.
- 15482d7: LLM usage governance now has provider conformance coverage, versioned pricing registries, quota enforcement, and generated SaaS smoke evidence.
- 6d3f54a: Presentation package docs now describe `@croco/meta-vite` as the Croco-native SSR/RSC runtime, while retained Vike preset naming is marked as legacy compatibility for generated meta-vite profiles.
- d4c83f1: Generated meta-vite profiles now include a presentation smoke command that dispatches page, API, server-action, and ISR routes against current Croco presentation package artifacts.
- 9556d22: Add CI-oriented operational checks with token-guarded diagnostics smoke coverage and app-provided diagnostics provider registration.
- 9b4dd2a: Add a production-app starter preset with REST API, React SPA, telemetry, Problem handling, retry/event/repository wiring, Lambda entrypoint, and generated smoke validation.
- 9a2040b: Generated contract workflows now emit a schema-versioned `.croco/manifest` bundle, validate it through the Project Map drift gate and `croco doctor`, and reference it from generated OpenAPI and RPC outputs.
- 1dbb0e8: Expose a Project Map manifest command and generated-app drift check scripts.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 14bd9f8: - Runtime capability manifests can now be emitted and compared for Node, Lambda, and Cloudflare Workers with deterministic `RuntimeCapabilityManifest v1` output.
  - Unsupported runtime capability use now carries the stable `CROCO_RUNTIME_CAPABILITY_001` diagnostic context.
  - Generated apps now write `croco-runtime-capability.manifest.json`, and doctor/smoke checks validate the manifest for supported runtime targets.
- c54e7b5: Runtime policy capability requirements can now be checked against typed runtime presets before app execution.
- 713c11e: - Harden the generated SaaS golden path with a versioned smoke contract, entitlement-backed seat limits, billing-backed entitlement plan sync, provider profile docs, and explicit demo endpoint gating.
- e4ced73: `create-croco-app --preset saas` now generates a smoke-tested SaaS golden path baseline.
- 37381fa: SaaS presets can select production provider profiles and now emit profile manifests, env contracts, deploy notes, and profile smoke checks.
- e7c4ce7: Add a static architecture policy engine and CLI gate for package/layer boundaries, public entrypoint imports, and generated SaaS app policy manifests.
- f8e4056: Generated app REST routes now declare schema-backed contract decorators, and protocols-core is included in the staged strict contract typecheck gate.
- bb59160: - Generated REST contract gates can now run strict schema diagnostics that fail before RPC/OpenAPI
  generation when routes omit response, body, path, query, or header schemas.
- e5361bc: Generated standalone Next web apps and shared UI components now use StyleX instead of Tailwind CSS, while Vite-owned frontend presets avoid receiving default Next web app files.
- ac9118b: Add a first-class Croco application testing harness with HTTP, event dispatch, request context, transaction, and telemetry helpers, and generate an API sample test that uses it.
- 9ad65a3: Generated RPC clients now expose a package barrel, preserve JSON-safe literal/enum/union/record schema types, and fail generation for unsupported Zod schemas instead of widening contracts through implicit fallback types.
- 53e9489: `croco generate usage-dashboard` now creates a tenant usage dashboard API with quota and overage states, and the SaaS preset seeds dashboard-ready normal and over-quota usage data without external credentials.
- Updated dependencies [51b0f14]
- Updated dependencies [9b96933]
- Updated dependencies [40b024d]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
- Updated dependencies [ad2e4f3]
  - @croco/telemetry-sdk-node@0.0.4
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/telemetry-sdk-node@0.0.3
  - @croco/problems-core@0.0.3
