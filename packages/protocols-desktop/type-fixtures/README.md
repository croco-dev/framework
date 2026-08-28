# Desktop type contract fixtures

`pnpm desktop-contracts:type-fixtures` executes TypeScript against two explicit contracts. The
dedicated benchmark workflow runs this compile-fixture suite before measuring performance:

- `negative.ts` must fail once at each reviewed `EXPECT_ERROR` marker. The harness rejects missing,
  duplicate, or unrelated diagnostics and forbids `@ts-expect-error` in these fixtures.
- `large-app.ts` must compile with 200 commands and 20 windows while preserving exact contract keys
  and contextual handler input inference. Its generator is checked for drift before compilation.

`pnpm desktop-contracts:bench` runs the large fixture once for warm-up and three measured times, then
compares median wall time, peak resident memory, and TypeScript instantiations with
`benchmark-baseline.json`. Wall time allows 2.5× baseline for shared-runner variance, peak memory
allows 1.75× for operating-system variance, and deterministic instantiations allow 1.25× so type
complexity regressions fail first. The dedicated benchmark workflow runs this command separately from
Vitest timing.

Refresh an intentionally changed baseline with `pnpm desktop-contracts:bench:update` and review all
three metrics before committing it. Regenerate an intentionally changed synthetic application with
`pnpm desktop-contracts:generate`.
