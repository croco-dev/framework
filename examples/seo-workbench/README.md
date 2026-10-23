# SEO workbench

This synthetic standalone profile compares normalized search aggregates with optional landing-session,
server-confirmed outcome and LCP p75 aggregates. It requires no GSC account, collector, database or LLM.
`src/input.ts` supplies asymmetric, fixed PT windows; `src/fixture.ts` composes the actual calculation,
`registerSeoQuery`, `MetricReadService`, authenticated admin operations and a scoped local report store.
The in-memory store is demonstration storage; production hosts provide their existing private report
repository, session authority and masking policy. No production search data is collected.

After the repository build, run `pnpm --filter @croco-example/seo-workbench test`. The mounted browser
contract runs with `pnpm --dir packages/admin-react vitest run src/tests/SeoWorkbench.spec.ts` and uses
an ephemeral loopback server, real operations and Chromium, with screenshots outside the checkout.

## Input contract and calculations

`compareSeo(input)` owns SEO semantics. Each dataset declares app/environment/tenant, source revision,
definition version, source timezone, half-open UTC window, grain, unit, denominator, completeness,
coverage and provider state. Source definition versions must capture aggregation type, search type,
filters and population semantics. Search and landing have independent denominator definitions.
Daily window edges must be midnight in the declared timezone. PT means `America/Los_Angeles`, including
DST. A daily PT aggregate cannot be converted into a daily KST aggregate. Landing inputs must already
be aggregated over the same PT window to join; otherwise their values remain unavailable and a stable
diagnostic explains the mismatch. Baseline/current search comparisons require matching source semantics,
timezone and equal elapsed durations. Baseline must end at or before current begins; DST windows with unequal duration remain incomparable.

Each source is bounded to 10,000 rows; disjoint baseline/current populations can produce at most
20,000 comparison rows before candidate filtering. Admin responses remain bounded to 100 rows per page.
The comparison population is the union of mapped search page/device rows in the two periods.
Landing-only rows are diagnosed rather than assigned invented search counts or added to that population.
Supported grains are page/device and page/device/query. The page registry maps each source URL to a
stable page id, template and locale, with a source reference and an effective interval that covers the
whole source window. Missing or mid-window mappings are excluded with evidence; ambiguous mappings
fail. Duplicate source grain fails rather than double counting. Canonical aliases may coalesce counts.
CTR is `sum(clicks) / sum(impressions)` and zero denominators produce null with a reason. Position and
LCP p75 are retained only at their original single-row grain; neither averages across aliases or queries.
`outcomes` counts sessions with at least one server-confirmed value action, so it cannot exceed sessions.
Missing counts remain null. Absent rows, incomplete data and provider failures never become zero.

Search query details are returned coverage, never the full search population. Anonymous (`null`) and
missing query fields are counted separately. Query strings do not leave the calculator, and query-grain
rows never receive landing outcomes. No purchaser identity is accepted. Raw page URLs are replaced by
registry ids before output; admin policy masks page ids, source references and change descriptions.
The [Search Analytics query reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
defines PT dates, aggregation and returned-row limitations. A paginated API response is not proof of
complete population coverage; declare `returned-rows` unless independent source evidence establishes it.

Candidate definitions persist their thresholds, support minima, baseline/current windows, filter and
version in reports. Thresholds use relative changes, not percentage-point changes. The UI edits UTC
[from, to) instants; the host loader must retrieve the selected normalized frames, whose search windows
must match the definition. Relabeling an old frame is rejected. The synthetic source contains PT daily
frames for September 30 and October 1–2, 2026; changing the baseline selects different actual counts. The
impressions-up/clicks-down filter requires actual opposing changes with sufficient support; the value-rate
decline filter compares outcomes/sessions only when both landing sources are compatible and complete.
Counts, inclusion/exclusion totals, source metadata, mapping references, definition and input SHA-256
remain inspectable. The hash identifies exact normalized input order and values with canonical object
keys. It is not a signature. Change markers are annotations, not causal evidence or revenue predictions.

## Shared import, warehouse and permissions

`importSeoSearch` and `importSeoLanding` use `@croco/etl-core/source` CSV/JSONL decoding, limits and
row-position errors. `collectSeoSource` applies the same semantic normalizer to normalized records,
including canonical numeric strings from warehouse int64/decimal columns, rejecting unsafe counts.
The optional `readSeoWarehouse` path delegates pagination, cursor identity, privacy/permission epochs,
cancellation and row/byte/page bounds to the existing shared warehouse reader. Bind metadata from the
immutable source snapshot and its quality; this API never promotes missing coverage to complete.
`packages/warehouse-postgres/src/tests/SeoComparison.integration.spec.ts` exercises this path with a
real temporary PostgreSQL publication, one-row pages, a page-budget failure and privacy revocation.
Run it with `CROCO_TEST_REAL_RESOURCES=1 pnpm --dir packages/warehouse-postgres vitest run src/tests/SeoComparison.integration.spec.ts`.
No GSC collector or SQL/parser engine is added.

The runner keeps temporal completeness and population coverage independent. Report `partial` can also
mean an unavailable comparison or derived field while its source quality remains complete.

Register raw loaders through `registerSeoQuery`, then use `MetricReadService` for field permissions,
source revisions, budgets, cancellation, verified reports and authority rechecks. The admin reader
factory binds the registered definition and authenticated app/environment/tenant on the server.
`createSeoWorkbench` separately enforces read/report/export/delete permissions, explicit tenant scope,
bounded pages (1–100 rows), source hashes and retention (at most 30 days). Host repositories must isolate
all scope fields. Saved reads recompute using current authority, source identity and field masking;
expired/stale reports are unavailable. Deletion uses the same scoped repository. Exports contain the
same masked aggregate evidence. Browser-provided permissions or tenant omission grant nothing.

For final release, `authenticate(metricAction)` must return SEO permissions and `metricGrant` for that
exact action from one coherent authorization snapshot using the reader's `MetricReadAuthority`.
The fixture reuses one policy function for both paths. Missing or revoked metric grants fail closed.
`MetricReadService.prepareResultRelease` binds the original in-process outcome, principal, source
snapshots, permission/privacy epochs, budget, deadline and cancellation. After the combined authentication,
the workbench validates this receipt and masks/projects synchronously, without another asynchronous
authorization gap. Copied/serialized outcomes cannot acquire a receipt. Hosts must keep their own
asynchronous store writes atomically authorized; the receipt does not create a storage transaction.

`SeoWorkbench` applies filters through real server reads, shows denominators and coverage, opens page
details with keyboard focus restoration, and exposes only explicitly registered diagnostic callbacks.
Do not register an SEO/performance action unless that tool exists and enforces server authorization.
Changing `scopeKey` unmounts previous scope state. The UI clears old results during pending or denied
reads and discards superseded asynchronous work. Save/export actions carry the applied definition and
input hash; the server rejects source drift.

The three deployment profiles are not certified by this example. The pure calculation has no Host
lifecycle. Host authorization, durable report storage, provider connection limits and deployed rendering
remain application responsibilities; the infrastructure review records these limits separately.
