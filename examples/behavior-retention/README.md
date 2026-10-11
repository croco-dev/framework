# Behavior retention

Build dependencies with `pnpm build --filter=@croco-example/behavior-retention...`, then run:

- `pnpm --filter @croco-example/behavior-retention start`: normalized observations without a database.
- `pnpm --filter @croco-example/behavior-retention smoke:sources`: common JSONL import and registered MetricReadService query match the same 40/100 fixture; a saved view survives recreation of the host using a scoped temporary file repository.
- `pnpm --filter @croco-example/behavior-retention dev`: React workbench at `http://127.0.0.1:4322`, with trend/cohort cells, frequency histograms, masked paged denominator inspection, save/open, and ready/empty/provisional/insufficient/denied/error observation controls. Loading appears during requests.
- `pnpm --filter @croco-example/behavior-retention smoke`: temporary real PostgreSQL provider (Docker required), pinned publication and bounded row paging match normalized periodic/cohort retention and count/active-days frequency. Cross-tenant cursors, limits and cancellation reject.

The normalized example and shared `packages/metrics-core/src/tests/fixtures/behavior-events.jsonl` describe 100 prior subjects, 40 returning subjects, 80 new subjects and three distinct actions on one local day. New subjects do not inflate the prior denominator. The source tests also use this fixture for CSV and JSONL comparison.

The UI host uses synthetic observations, fixed local demo permissions and an OS temporary directory; it requires no credentials. It returns aggregates and masked labels only. Real applications supply authenticated scope, an existing host repository and immutable source runs; this demo is not an authentication implementation. The completeness/history metadata is explicit fixture evidence, not inferred from missing rows. No production data is read or changed.
