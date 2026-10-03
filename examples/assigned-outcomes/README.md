# Assigned net outcomes

A zero-database example with 100 assigned people in each arm. All fixture data is synthetic. The server registers `createAssignedOutcomeQuery` with `MetricReadService` and passes its report to `createNetOutcomeOperations`; the browser receives aggregate totals and masked drilldown pages.

```sh
pnpm install
pnpm --filter '@croco/admin-react...' build
pnpm --dir examples/assigned-outcomes smoke
pnpm --dir examples/assigned-outcomes dev
```

Open <http://127.0.0.1:4323>. Enter effective and known cutoffs plus a revision, then refresh. Inspect an arm, currency, and source to read at most 20 masked event records.

The frozen assignment snapshot includes all 200 people, including those with no payment. One person in each arm makes a payment, and each refund links to that person’s payment. The fixture yields control net `100000 - 20000 = 80000`, or `800 / 1` per assigned person, and treatment net `110000 - 15000 - 20000 - 1000 = 74000`, or `740 / 1`. Treatment minus control is `-60 / 1`. The treatment noncash face value `500` is shown separately. These descriptive differences do not establish causal uplift.

The example includes browser verification fixtures at `/?fixture=partial`, `empty`, `denied`, `error`, and `loading`. They exist only in this example host. The normal fixture is `ready`. Permission and privacy epochs are fixed for this synthetic host; a deployed host must resolve authenticated scope and current authorization on every operation. The core adapter rechecks both epochs before returning a result and does not cache financial data.
