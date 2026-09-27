# Metric read with a reviewed report

This zero-credential example registers a metric definition and query, then reads an in-memory reviewed report. The first read matches the definition, query, authorization epochs, source revision, and snapshot reference. Its result comes from the report without running the executor.

The second read changes the trusted source revision and snapshot reference. The old report no longer matches, so the registered executor runs and returns an explicit `partial` outcome. The example checks both results and prints their statuses and executor counts.

```bash
pnpm --filter @croco/metrics-core build
pnpm --filter @croco-example/metric-read typecheck
pnpm --filter @croco-example/metric-read smoke
```

The reader is an in-memory demonstration of a trusted report store. Its `verify` method checks a SHA-256 digest of the actual result payload and the reviewed definition and result hashes, reviewer identity, and review timestamp. A production reader must establish reviewer authenticity and protect stored report contents with its own trust boundary. Authorization and source state here are fixed demonstration fixtures, not application defaults.
