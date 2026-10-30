# Static misuse exception review: October 2026

Review date: 2026-10-30. Scope: the 37 raw-error entries and two empty-catch entries that expired on
2026-10-29, tracked in [#4004](https://github.com/croco-dev/framework/issues/4004).

The source locations, excerpts, owners and baseline counts remain in the existing
`scripts/static-misuse-*-allowlist.json` files. Those files are the machine-checked authority; this record
explains the retention decisions. No new exception, checker exemption or production behavior is introduced.
The raw-error baseline remains 37 entries and the empty-catch baseline remains seven entries, of which only
the two expired entries are renewed here. Other exception families are outside this review.

## Retention decisions

Each retained entry now describes its actual failure boundary. The next review dates are spread by package
and fall within 90 days of this review. The existing owner remains accountable for removing the exception or
providing fresh evidence before that date; these dates are not permanent approval.

| Package              | Expired entries | Boundary and retention reason                                                                                                                                                                                                                                                                                                                                           | Next review |
| -------------------- | --------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `admin-ops`          |               4 | `sourceAdapters.ts` rejects unavailable audit/replay capabilities and a lifecycle run that disappeared before recovery. `createRetryConsole.runRecovery` in `retryConsole.ts` owns conversion into a failed recovery result with `admin-ops/provider-recovery-failed`; the adapter must not execute an unsupported recovery or invent a second public Problem contract. | 2027-01-05  |
| `diagnostics-core`   |               1 | `ErrorHistoryRingBuffer` rejects nonpositive capacity before allocation. Retain the existing constructor assertion while a dedicated configuration diagnostic would require a separate compatibility decision. This does not establish validation of every possible numeric input.                                                                                      | 2027-01-07  |
| `frontend-problems`  |               1 | `assertProblemExhaustive(never)` reports a programmer's unhandled variant, outside the domain Problem union it checks. Retain the thrown assertion rather than adding another domain variant.                                                                                                                                                                           | 2027-01-09  |
| `idempotency-core`   |               4 | `conformance.ts` asserts provider results, finite leases and expected rejection. A verification failure must remain distinct from the provider's expected idempotency Problems.                                                                                                                                                                                         | 2027-01-11  |
| `meta-vite`          |               1 | The shared `CacheStore.getOrSet` contract permits `undefined`, including invalidated in-flight loads. The current ISR middleware promises its caller a `Response` and rejects this no-response outcome. Retain that existing rejection; cancellation/fallback behavior and a stable ISR diagnostic require separate behavior review.                                    | 2027-01-13  |
| `migration-runner`   |               1 | `getPackageVersion` reads statically imported package metadata for CLI version reporting. Missing metadata is a broken package invariant, not a migration apply outcome. Retain startup rejection until that packaging boundary defines a dedicated diagnostic.                                                                                                         | 2027-01-15  |
| `outbox-core`        |               1 | The conformance Unit of Work callback deliberately throws after recording an intent so the suite can prove rollback removed it. This injected test failure is not an outbox delivery outcome.                                                                                                                                                                           | 2027-01-17  |
| `problems-core`      |               1 | `assertProblemExhaustive(never)` must fail for an unhandled programmer variant without recursively introducing another domain Problem.                                                                                                                                                                                                                                  | 2027-01-19  |
| `protocols-core`     |               1 | `getConsumerDefinition` accepts the closed `ContractGraphConsumerId` union. A missing definition is a programmer-supplied identity error, not coverage for a valid graph consumer. Retain rejection instead of inventing coverage.                                                                                                                                      | 2027-01-21  |
| `rpc-codegen`        |               1 | The generated `assertExhaustiveProblem(never)` template follows the standalone exhaustive helpers. Changing its error model would change generated consumer behavior and needs separate contract review.                                                                                                                                                                | 2027-01-23  |
| `testing`            |              17 | `failure-drill.ts` rejects missing or mismatched Problem/recovery/telemetry/audit observations. `testing.ts` rejects malformed HTTP/OpenAPI observations and circular test-provider construction. These are verification failures, distinct from application Problems under observation.                                                                                | 2027-01-25  |
| `webhooks-core`      |               4 | `conformance.ts` rejects mismatched decoded events and missing or incorrect signature rejection. Its assertion errors remain distinct from the adapter's expected `InvalidWebhookSignatureProblem`.                                                                                                                                                                     | 2027-01-26  |
| `framework-context`  |               1 | `reportRuntimeInspectorFailure` has delivered the original error to the optional reporter before isolating a failure of that reporter itself. Rethrowing or recursively reporting that secondary instrumentation failure would disrupt the application. The helper supplies no successful inspection record.                                                            | 2027-01-27  |
| `transports-graphql` |               1 | The startup catch covers only optional Logger resolution and its info message after the Node listener has bound. Bind errors reject through `onError`; schema and request failures are outside this exception. Logging failure must not reject an otherwise serving listener.                                                                                           | 2027-01-28  |

## Verification boundaries

The checker still rejects stale dates, missing owners, mismatched source pins and growth without an explicit
baseline update. `scripts/tests/static-misuse-check.spec.ts` contains the existing negative controls for these
rules. Retaining a source assertion does not exempt its caller or another throw in the same file.

The ISR decision follows `packages/cache-core/src/libs/CacheStore.ts` and
`InMemoryCacheStore.readLoadResult`: a valid cache operation may return `undefined` after invalidation even
when its loader produced a value. The existing `InMemoryCacheStore.spec.ts` case
`invalidatePattern() during getOrSet load: loader completes but value not stored` proves that cancellation
behavior. ISR currently supplies only `ttlMs`, so it does not request `preserveInvalidatedValue`. This review
preserves the middleware's current rejection without claiming a stronger provider contract.

The package evidence includes the existing exhaustive-helper, conformance, failure-drill, recovery-console,
ISR and diagnostics tests. Two focused regressions make the empty-catch decisions explicit:

- `RuntimeInspector.spec.ts` verifies that the reporter receives the original inspection error once, and that
  its own failure does not escape `recordRuntimeInspectionEvent`.
- `GraphQLServer.spec.ts` verifies a real bound Node listener still serves a GraphQL request when startup
  logging throws. Existing occupied-port and synchronous-listen-error tests retain the separate failure path.

This review preserves failure behavior; it does not convert these assertions into recoverable domain outcomes,
certify a deployment profile, or complete another issue's validation. After this change reaches the target
base, consumers such as [#3897](https://github.com/croco-dev/framework/issues/3897) must validate their own
candidate against that base.
