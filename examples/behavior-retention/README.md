# Behavior retention without a database

Run `pnpm --filter @croco/metrics-core build` and then `pnpm --filter @croco-example/behavior-retention start`.

The example uses normalized `report.saved` observations for one tenant. It demonstrates 40 retained subjects from 100 prior active subjects, 80 new subjects in the returning week, and the difference between three actions and one active day. It requires no warehouse or import service. The `completeThrough` and `knownHistoryFrom` values state the observation boundaries; omitting either changes availability rather than silently treating missing history as zero activity.
