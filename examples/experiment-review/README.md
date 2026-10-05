# Experiment review with normalized inputs

This zero-credential example loads fixed CSV assignment and outcome fixtures through the shared
`decodeSource` parser (`#2857`), pages them through the shared `WarehouseReader` contract (`#2845`),
and summarizes the normalized dataset with `summarizeExperiment` (`#2822`). The same dataset is
served through the `ExperimentReviewSource` console contract and read through a registered
`MetricReadService` query (`#2862`). The example asserts normalized/direct parity and prints the
randomized-denominator aggregates.

```bash
pnpm --filter @croco-example/experiment-review typecheck
pnpm --filter @croco-example/experiment-review smoke
```

`tenantId` omission never loads global data. There is no automatic winner and no causal claim: the
ready view reports allocation quality (`SRM`), treatment reach (`conditional`), and descriptive
outcomes separately. Provider failures surface as explicit `not_assessed` evidence without zero-fill.
