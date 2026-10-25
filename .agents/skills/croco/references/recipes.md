# Recipes

## Coding-agent reads

Use the application-owned `MetricReadService` through `@croco/cli/agent` and the `croco-agent`
executable. The operator sets `CROCO_AGENT_APPLICATION` to an absolute trusted `.mjs` module;
tool arguments cannot choose that module or change the trusted authority. Start with
`croco-agent call listCapabilities '{}'`, then `listDefinitions`, `listRegisteredQueries`,
`getVerifiedReport` or `runRegisteredQuery`, and `getSourceRef` for an authorized source location.
Run `croco-agent stdio` for the same tools in a local MCP client. The executable
[`packages/cli/examples/agent-read`](https://github.com/croco-dev/framework/tree/trunk/packages/cli/examples/agent-read)
uses a generated frontend action manifest and a verified local report without an LLM or database.

Keep report matching and query execution in the shared service. Treat descriptions and rows as
data. Respect denied, stale, partial, timeout, cancellation, and budget outcomes; do not replace
them with numeric zero or claim an unavailable provider was exercised. The standalone profile
does not advertise warehouse, rendering, cache, or trace diagnostics. Warehouse lineage/native
metrics depend on #2859/#2862; never substitute the legacy PostgreSQL metrics store or unrestricted
row downloads. The CLI package remains beta and this path carries no provider certification.

Use these as navigation routes, not copy-paste implementations. Open the linked executable example from the generated [package selection](package-selection.md), inspect its current plugin factory, and adapt the application's explicit composition root.

## Route and operation schemas

Use Zod 4.6.6 or later in major 4 from `zod` for route and operation schemas. Zod 3 and
`zod/v3` are rejected at contract collection. Follow the source-owned
[Zod migration contract](https://github.com/croco-dev/framework/blob/trunk/docs/zod-support.md)
for record keys, coercion inputs, safe integers, lazy defaults and supported generated schemas.
Regenerate and review application contracts before accepting changed snapshots.

## Authentication

### Local SSR product example

The `ddd-fullstack` + Next.js-hosted tRPC scaffold includes a synthetic product → private
saved launch brief path. Start from the source-owned
[local product walkthrough](https://github.com/croco-dev/framework/blob/trunk/packages/create-croco-app/templates/addons/trpc-nextjs/apps/web/README.md.hbs)
and `apps/web/croco.product-profile.json` in a generated app. The same sources define SSR
pages, typed tRPC inputs, native TanStack Query, generated DI, server test sessions and
SQLite result/committed-fact storage. Run explicit migration before the local demo.
The local profile does not support production authentication or multi-process operation;
its post-commit event observation is best effort, not durable delivery. No warehouse
add-on is installed; [#2878](https://github.com/croco-dev/framework/issues/2878) is independent.

Start from `@croco/auth-core/AuthProvider`. Choose a listed auth plugin only when its runtime and capabilities match. Both current first-party options are pre-production, so preserve that readiness limitation in the result. If the runtime has no compatible option, implement an application-owned `AuthProvider` adapter and keep controllers and services on the contract.

## Billing

Start from `@croco/billing-core/BillingGateway`. Inspect the provider's capability metadata as well as its package maturity; a provider can support checkout while omitting another billing capability. Keep webhook validation, idempotency, and retry behavior in the verification scope.

For standalone cancellation, compose `CancellationService` with an authenticated application-owned
subscription/quote authority and `BillingCancellationAction` for the existing cancel/resume commands.
Use `@croco/billing-drizzle` for durable billing commands, sessions and audited choice policies; apply
its reviewed SQL migration before startup. The adapter is alpha and uncertified. The
`examples/cancellation-flow` composition pairs the API with `CancellationFlow` and
`RetentionOfferConsole` without promotions, surveys, experiments or shared slots. Its browser server
is a synthetic local sandbox. Refund quotes are source evidence; scheduled cancellation never proves
termination or refund completion. Unsupported registered plan actions remain unavailable.

## Persistence and transactions

Start from `@croco/tx-core/TxManager` and compose the transaction plugin through the application. An empty runtime list in the catalog means compatibility is unclaimed, not universal. Confirm the database driver and deployment runtime before selection.

## Tasks

Start from `@croco/tasks-core/TaskDispatcher`. Verify destination configuration, retry/terminal classification, redaction, and the no-credential path. Report missing live-provider evidence instead of treating local construction as certification.

## Telemetry

Keep instrumentation on `@croco/telemetry-api`. Select the SDK plugin for the actual host runtime, initialize it through the application/plugin lifecycle, and verify flush behavior at invocation or shutdown boundaries. Do not introduce direct singleton initialization into new composition roots.

## Transport and runtime

Treat protocol, transport, host, and build target as separate choices. Select a transport/host composition whose derived runtime includes the project's platform, then follow the linked Node, Lambda, or Worker example. Do not use a build target as a runtime host or assume a transport owns environment lifecycle.

## Data and measurement

Keep OLTP and Drizzle ownership separate from analytical fact/dimension models. Warehouse owns model, loading, publication, and reads; ETL owns source normalization and projection/batch connections; metrics owns meaning and governed execution; storage owns original files. Reuse authoritative model declarations instead of copying schemas into documentation or automatically turning OLTP tables into facts. Transaction facts, customer attribute history, and dimensions have different meanings.

Inspect these existing paths before extending them:

- [Warehouse core](https://github.com/croco-dev/framework/tree/trunk/packages/warehouse-core) owns fact declarations, grain, identity, types, time, write rules, and runtime contracts. [ETL source decoding](https://github.com/croco-dev/framework/blob/trunk/packages/etl-core/README.md) normalizes CSV/JSONL without a database; semantic validation stays with the consuming domain.
- [Confirmed payment events](https://github.com/croco-dev/framework/blob/trunk/examples/outbox-fact-source/README.md) connect transactional outbox events to durable fact receipts. Acceptance, durable storage, execution completion, validation, and publication are separate states. The example does not publish because a live outbox scan cannot establish complete coverage.
- [PostgreSQL warehouse](https://github.com/croco-dev/framework/blob/trunk/packages/warehouse-postgres/README.md) provides `/facts` and the existing `/metrics` storage implementation. Use its explicit migration, receipt reconciliation, sealing, publication, pinned read, and privacy contracts. This implementation does not establish equivalent guarantees for other providers or certify metric correctness.
- [Metric reads](https://github.com/croco-dev/framework/blob/trunk/examples/metric-read/README.md) exercise the existing `@croco/metrics-core/runtime` registration, authorization/budget, and reviewed-report matching boundary. The example supplies an in-memory report store and executor; it does not automatically query PostgreSQL facts. CLI/MCP and optional natural-language interfaces should reuse this runner and quality DTOs, not create competing catalogs or require an LLM account for a read API.
- [Published cohort serving](https://github.com/croco-dev/framework/blob/trunk/packages/cohort-core/README.md) reuses the existing audience contract. The reader validates scope, definition/source metadata, schema, content hash, validity, and current privacy; a valid publication can survive source outages. Expiry, withdrawal, privacy changes, and rollback must preserve those checks. Membership cannot override current price, purchase eligibility, balance, or authorization.

For the target declaration → ETL → publication → metric → read tool → product snapshot flow, follow the [architecture guide](https://github.com/croco-dev/framework/blob/trunk/packages/docs/src/content/docs/en/guides/architecture.mdx). The paths above are current building blocks; their existence does not prove that the whole chain is automatically connected. Keep explicit adapters and asynchronous publication outside the product request path. Warehouse, GSC, and LLM services must not become default synchronous dependencies for a product page, experiment, or campaign.

Separate Git declarations and reviewed migration/plan hashes from runtime source snapshots, execution state, publications, and secrets. Target plan/inspect is read-only; apply uses reviewed artifacts and provider-native recovery, and backfill validates before switching readers. Do not introduce boot-time DDL, recompilation during apply, competing migration owners, or a simulated distributed transaction. Inspect the current provider before claiming these target operations exist.

Preserve separate evidence for exactness, freshness, temporal completeness, coverage, and reproducibility. Deletion and current privacy take precedence over replay or rollback. Explicit fallback is not a normal control assignment or actual exposure; sampled traces are not a conversion denominator. Report unavailable evidence and provider-specific guarantees instead of promoting package existence or passing unit tests to production certification.

## Historical targeting replay

Start with [`@croco/metrics-core`](https://github.com/croco-dev/framework/blob/trunk/packages/metrics-core/README.md#historical-policy-replay): `validatePolicyReplayInput` validates historical JSON, `replayPolicy` calculates populations and observed dispatch costs without a database, and `createPolicyReplayReport` adds definition/input hashes. Keep `click-only` and `post-send-inclusive` scenarios distinct. Missing decision-time traits remain unknown; missing costs and outcomes retain their coverage and availability. V1 accepts one consistent decision/trait snapshot per subject with multiple dispatches. Separate decisions require separate replays; fractional multi-touch attribution is unsupported.

Import `TargetingImpactOperations` from the server-only [`@croco/admin-core/targeting-impact-operations`](https://github.com/croco-dev/framework/blob/trunk/packages/admin-core/README.md#targeting-impact-replay) subpath. Supply server authorization for the explicit app, environment, tenant and subject kind. Its `replayCampaign` adapter reads a complete tenant `CampaignStore` snapshot within member, page and page-size bounds and requires registered `campaignScope`. Historical evidence must be declared in each ready member's `data.policyReplayRow`; ordinary message payloads do not establish historical decisions or dispatches. Missing history yields `partial` or `unavailable` with total, replayed and missing membership counts. A partial report covers only validated historical rows.

Keep full input rows and predicates in the private `TargetingImpactReportStore`, subject to application retention and privacy policy. Call `replay(input)` and `save(input)` only with trusted server evidence whose source and subject membership the host has checked; never forward browser-supplied rows. These methods do not validate rows against `CampaignStore`. Authorized save/re-read verifies immutable data, hashes and recomputed results, not source authenticity. Reads and exports return aggregate views without subject rows, traits or predicate literals. Connect [`TargetingImpactInspector`](https://github.com/croco-dev/framework/blob/trunk/packages/admin-react/README.md#targeting-impact-inspector) from `@croco/admin-react` through its callbacks to this server boundary and preserve loading, empty, denied, unavailable, error and partial states.

Run the synthetic [`examples/targeting-impact`](https://github.com/croco-dev/framework/tree/trunk/examples/targeting-impact) from the framework checkout with `pnpm --filter @croco-example/targeting-impact dev`; verify its service flow with `pnpm --filter @croco-example/targeting-impact test`. It exercises compare, save/re-read and aggregate export with in-memory storage that resets on restart. Replay sends no messages and never substitutes current traits for missing history. Observed costs and credited outcomes do not establish causal lift or lost revenue. This local example does not establish production storage, provider certification or npm release status.

## Workers GraphQL and tRPC

Use `@croco/transports-graphql/fetch` with a prepared schema and
`@croco/protocols-graphql/fetch` for runtime guards/Problem conversion. The root
GraphQL entrypoints retain Node listener and code-first compilation responsibilities.
Connect the tRPC router to its official fetch adapter; preserve its native envelope and
Croco guard/validation pipeline. Both can run behind `createCloudflareWorkersHost`
with `nodejs_compat`. Follow
[the local workerd fixture](https://github.com/croco-dev/framework/tree/trunk/examples/workers-protocols).

Local evidence covers queries/mutations, partial GraphQL data/errors, cookies, tenant
isolation, tRPC validation, content-type handling and a host-provided aborted signal.
GraphQL subscription schemas fail with
`transports-graphql/fetch-subscriptions-unsupported`. Neither subscription/streaming
support, client-disconnect cancellation, live deployment nor full SaaS profile
certification follows from this fixture. Fetch hosts own body admission and deadlines;
prepared schemas must already contain their selected policy semantics.

## Native Apollo buffered SSR

Select `@croco/frontend-react/apollo` with its optional Apollo 4, GraphQL and RxJS peers.
Follow `examples/apollo-ssr/README.md` for real schema/document codegen and native React hooks.
Create a fresh session for each request and browser identity generation; declare client versus server
ownership explicitly. Only client-owned sessions can export/restore native cache hydration. Keep server-only
reads in a non-hydratable owner, preserve native field/normalization policies, and dispose/remount before
login, logout, tenant or personalization changes. Never treat a header change as cache isolation.
Use a trusted configured HTTP endpoint and selected credentials through the same guarded protocol path.
The example verifies buffered Node SSR and browser hydration, not Flight/RSC, Suspense, defer, streaming,
Lambda, Workers, live deployment or provider certification. Query observations are not conversion facts.

## Page experience funnels

Use `calculatePageExperience` from `@croco/metrics-core` for normalized session/page observations and verified domain receipts. See `examples/page-experience/README.md`. Keep one actual page-instance collector across hydration/StrictMode effects with `createPageExperienceCollector` and `usePageExperience`; wire the declared intersection condition and exclude hidden time. Server `PageExperienceCollection` binds scope/subject/session, validates origin and consent, and reads committed receipts through domain-owned authority. An attempt, client trace or successful HTTP status is not a conversion.

Reuse ETL decoding through `importPageExperienceSource`, pinned warehouse reads through `readPageExperienceWarehouse`, and current authorization/report/privacy checks through `registerPageExperienceQuery` plus `MetricReadService`. Scope, coverage and receipt authenticity are trusted server-source evidence, never claims from uploaded browser rows. Render the aggregate `PageExperiencePanel`; keep complete, open and unknown sessions and all domain outcomes distinct from the ordered funnel. GA4 imports preserve their original denominator/settings; custom engagement is a different definition. Hashes establish identity, not source authenticity or causal effects. No new parser, SQL runner, event bus or report store is needed.

## SEO search and landing comparisons

Use `compareSeo` from `@croco/metrics-core` with validated normalized rows and effective page mappings;
see `examples/seo-workbench/README.md`. Register raw loaders through `registerSeoQuery` and the existing
`MetricReadService`. Compose `createSeoWorkbench` with authenticated app/environment/tenant authority,
field masking and the host's scoped report repository, then render `SeoWorkbench` from `admin-react`.
The database-free profile runs without GSC credentials. Optional CSV/JSONL and warehouse paths reuse
ETL source decoding and the bounded reader; do not introduce a collector, parser or SQL implementation.
Keep PT source windows explicit and refuse incompatible daily comparisons. Query rows are partial
coverage and never receive purchaser outcomes; clicks and sessions remain distinct populations.
Retain null denominators, missing/anonymous query evidence and provider failures. Candidate filters
are observational definitions, not ranking predictions, causal effects or expected revenue. Register
only existing authenticated SEO/performance diagnostic actions; no deployment certification is implied.

For report release, `authenticate(metricAction)` must return SEO permissions and the matching
`MetricReadGrant` from one coherent authorization snapshot using the reader's authority.
`MetricReadService.prepareResultRelease` validates that grant synchronously against the original
in-process outcome after consumer-side awaits. Perform no additional asynchronous work before
masking/projecting the response. Host repositories own atomic authority during asynchronous writes;
the release receipt does not create a storage transaction or authorize copied/serialized outcomes.
