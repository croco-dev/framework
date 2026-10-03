# Lifecycle Journey example

This example runs a code-defined interest follow-up through the lifecycle, task, execution, and trigger contracts with a fake message action. No cohort, policy release, reminder, contact policy, provider credential, or customer data is required.

```bash
pnpm --filter @croco-example/lifecycle-journey start
```

The first episode waits one hour. When the customer purchases during that wait, the next wake exits without a message. A second episode remains interested and receives one fake message after the hour. The command asserts both outcomes, a duplicate task delivery, and a worker restart using the same execution records. Its `@Cron` wake handler calls `JourneyTaskBridge`, which invokes a registered `TaskRunner` node task and creates inspectable execution records. The application owns the `purchased` and `interested` predicates, consent and item availability, and the registered message action; Croco owns the versioned graph, stored wake, node receipts, idempotency, and dispatch boundary.

For the local operator console, build workspace dependencies and run:

```bash
pnpm --filter @croco-example/lifecycle-journey dev
```

Open `http://127.0.0.1:4321`. The server binds to loopback and supplies a fixed demo operator and registered sample. The ordered form previews changes without dispatching or mutating the episode. Pause, resume, and stop submit audited revision and idempotency commands to the server operations boundary. This server is a local demonstration, not an authentication or production scheduler implementation.

Production hosts supply a trusted authenticated principal, a durable `PostgresJourneyStore` and execution store, registered predicates and actions, and a configured scheduler for the `@Cron` trigger. The bridge invokes the registered `croco.journey.node` task through `TaskRunner`. Each invocation advances at most one node. Persisted `wakeAt` and the store's leased `claimDue()` survive process restarts; no process sleeps for the wait duration. Keep old executable definitions registered while their episodes are active so each episode retains its starting version. The example's `MemoryExecutionStore` is disposable and only serves the zero-credential demonstration.

Node tasks have a 30-second timeout and at most three attempts. Failed tasks and expired running attempts use the same execution identity on retry. The fenced timeout policy relies on the Journey revision compare-and-set and durable action admission; an older attempt cannot admit a second logical action. A failed invocation does not prevent the remaining claimed episodes from being attempted, and the wake still reports the failure. Run the recovery and overlapping-worker regressions with `pnpm --filter @croco-example/lifecycle-journey test`.

The dispatch admission record is the pause fence. A pause that commits first blocks admission. If admission commits first, pause fails explicitly and the accepted or unknown external work cannot be recalled. An indeterminate intent must be reconciled from provider or operator proof before it can progress; it is never automatically sent again. Goal, consent, and resource checks happen immediately before admission, but a source can change after that check and before provider acceptance. The application must account for that external race in its delivery policy.
