# Reviewed text enrichment

This synthetic local example classifies a validated list, keeps dictionary/model candidates
separate from human labels, and exports only reviewed labels. It needs no Survey, Cohort,
Fact History or warehouse. It never contacts a vendor by default.

## Run locally

Use a disposable PostgreSQL database on loopback. Set `ENRICHMENT_POSTGRES_URL` explicitly;
the example refuses non-loopback hosts. Apply the additive migration and seed the synthetic
batch with `pnpm --filter @croco-example/enrichment-review setup`, then run
`pnpm --filter @croco-example/enrichment-review dev` and open the printed loopback URL.
`setup` is an explicit provisioning step; starting the server never runs DDL.

The synthetic records cover an exact dictionary match, a model candidate, unknown, prompt injection, PII blocking and provider failure. Classify
each row, enter an audit reason and review evidence, select the reviewed label, then approve.
Export stays blocked until all items have a human review. Authorized reviewers can also label a current original directly when a request budget prevents generating a candidate; that review records a null candidate reference and the selected definition version. Selecting v2 creates another candidate
without erasing the human override. Retry event/usage delivery resends only pending intents.
Unknown provider acceptance requires an explicit bounded retry approval and duplicate-billing
acknowledgement; confirm the previous worker has stopped first. At the final allowed attempt,
the same acknowledgement releases its uncertain concurrency slot without allowing another
attempt for that item. Its unknown usage and reserved budget remain recorded; other items can
then continue within the original run limits.
Changing the operator or authorization revision changes cache identity but never resets the
item/version model-attempt limit or bypasses acknowledgement of uncertain acceptance.

The HTTP host has one fixed synthetic principal and scope; it binds to loopback and checks Host,
Origin and cross-site requests. It is a demonstration, not deployable authentication. A real host
must resolve the principal and authorization revision on every call and connect the server
operations to its authorization, source-privacy and audit policy. Browser booleans grant no rights.

## SDK boundary

`src/openai.ts` directly uses the installed `openai@7.25.0` Responses client with
`text.format` strict JSON schema, finite IDs or null, `store:false`, no tools, an AbortSignal,
request timeout and `maxRetries:0`. This follows the official
[Structured Outputs contract](https://developers.openai.com/api/docs/guides/structured-outputs).
The application supplies its client and a pinned resolved model reference. An unexpected returned
model identity is a failure; aliases must be resolved by application policy, not silently accepted.
The module does not read credentials or construct a global client. `deterministicClassifier`
satisfies the same feature contract without an account. SDK conformance tests use a loopback HTTP
fixture to verify real serialization, usage, quota errors, malformed/truncated output and cancellation.
They prove protocol mapping, not vendor accuracy, availability or model quality.

PII policy runs before model dispatch over both text and context. This example blocks illustrative
email/phone patterns. Production applications must supply their actual block/mask policy; a regex is
not a general PII detector. Input instructions are serialized as data, schema output is validated
again, and the integration grants no tool, SQL, credential, or write capability to the model.
No prompt/output text is sent to telemetry or usage sinks.

## Persistence, recovery and budgets

`analytics-core/enrichment` is server-only. `DrizzleEnrichmentStore` owns one PostgreSQL row per
explicit app/environment/tenant/run. Each run is bounded to 100 inputs, 8 candidate versions/attempts
per item, 1000 audit records, and 50 rows per read. Revision CAS atomically claims each invocation
and reserves its request/token allowance before external work. Concurrent clients cannot claim the
same candidate twice. Per-item receipts survive a lost chunk checkpoint or worker restart.
`src/batch.ts` uses the existing `ChunkExecutor`/`Step` and execution checkpoint contract; it does
not add a scheduler. Chunk traversal completion is distinct from classified, unknown, failed,
reviewed and exported outcomes.

Budgets and concurrency are **per run**, not a tenant-wide daily quota. The application owns
cross-run admission/quota policy. `tokensPerRequest` is a conservative provider-specific reservation
including input, instructions/schema overhead and maximum output. It must be configured by trusted
application code; it is not measured usage or a guaranteed provider invoice ceiling. Known output
or total usage above the reservation fails explicitly. Reservations remain charged for unknown and
estimated usage. Unknown acceptance blocks further model work until an operator approves a bounded
retry or acknowledges the stopped worker after its final attempt; changing a run ID must not be used to bypass admission policy. Providers without idempotency
can bill twice after an acknowledged retry. SDK retries are disabled.

Results and a text-free, label-free event/usage intent are persisted together before sink delivery.
The idempotent `settle` callback is keyed by receipt ID; a failed sink never causes inference to
repeat. The example connects measured usage to the existing metering journal and publishes observational receipts through the existing in-memory event bus. These demonstration sinks are in memory; install durable event/metering
sinks for production. Unknown or estimated usage is never billed as measured zero. The PostgreSQL
outbox retains its operational intent across service restarts until settlement.

Only declared input, scope, limit and label fields are copied into persistence or the classifier boundary; extra source/credential properties are discarded.

Cache reuse is run-local: the same run ID is the restart/resume boundary; a new run is an explicit new classification workload. Cache identity includes scope, source/input revision, normalized input hash, sorted semantic context,
current actor and authorization revision, taxonomy/catalog, normalization and model/prompt identities.
Conflicting originals for the same scoped item/revision are rejected across runs; use a new inputRevision for new source content. PostgreSQL stores a text-free immutable source hash receipt separately from each run, and creates both atomically.
Human reviews are independent of candidates. Re-running a definition never erases a review, and
export rechecks that reviewed IDs remain allowed in the selected definition.

Original and result retention have separate expirations. Reads hide expired originals immediately,
while valid reviewed results remain exportable until their own expiration. Source access is checked
again before cache reads, transmission, review and export; deletion cannot be bypassed by cache.
Call `purge` from an existing application task to physically remove expired/deleted originals and
results. Minimal source/content hashes, audit command fingerprints, actor/reason records and
text-free operational usage receipts have separate operational retention owned by the application;
they are not claimed to be anonymous data. A purge does not erase unsettled usage obligations.

Batch execution payloads bind the scoped run, ordered item IDs and definition version. Reusing a checkpoint with a different order or version is rejected; start a new execution for a different workload. Raw retention and authority are rechecked immediately before SDK dispatch, and result retention is rechecked before export is returned. A request blocked before transmission records known zero usage; uncertain provider acceptance retains unknown usage and its budget reservation.

The additive `createEnrichment` migration is idempotent and independent of Fact History. Rollback
can stop using this new feature while retaining its receipts. Destructive table removal is a
separate operator decision after retention and settlement; there is no boot migration, automatic
package version bump, publishing action, or migration of existing customer data.
