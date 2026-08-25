# Jobs v1

Jobs v1 is the Croco-native operations surface for background work. It does not try to replace
Temporal or another external workflow engine. It standardizes how Croco apps define execution
records, inspect current and historical state, cancel stuck work, replay failed work, and preview
scheduled trigger changes before applying them.

## Public Surface

Jobs v1 is built on `@croco/execution-core`.

- `ExecutionManager` owns lifecycle transitions: create, start, complete, fail, cancel, retry,
  checkpoint, and timeout.
- `ExecutionInspectionManager` owns operator reads: get, list, and append-only logs.
- `ExecutionReplayManager` owns replay from failed or timed-out executions.
- `createExecutionJobsOperations(manager)` turns those capabilities into a stable Jobs operations
  contract: `list`, `show`, `logs`, `cancel`, and `replay`.

The store below is application-owned infrastructure; the snippet focuses on the Jobs operations
contract and is intentionally not standalone.

```typescript no-check
import { createExecutionJobsOperations, ExecutionManagerImpl } from "@croco/execution-core";
import { MyExecutionStore } from "./MyExecutionStore";

const manager = new ExecutionManagerImpl(new MyExecutionStore());
const jobs = createExecutionJobsOperations(manager);

const execution = await manager.create({
  type: "billing-sync",
  payload: { tenantId: "tenant_123" },
  maxAttempts: 3,
  idempotencyKey: "billing-sync:tenant_123",
  metadata: { workflowName: "billing.sync" },
});

await manager.start(execution.id);
await manager.recordLog(execution.id, { message: "Billing sync started" });
await manager.complete(execution.id, { subscriptionStatus: "active" });

console.log(await jobs.show(execution.id));
```

## CLI Inspection

Applications can expose the Jobs operations contract at `/jobs`. The CLI appends `/jobs` to the
URL passed with `--url`, so generated SaaS apps expose the same surface at `/ops/jobs` by using
their operations base URL:

```bash
croco jobs list --url https://api.example.com
croco jobs show exec_123 --url https://api.example.com
croco jobs logs exec_123 --url https://api.example.com
croco jobs cancel exec_123 --url https://api.example.com --reason "operator stop"
croco jobs replay exec_123 --url https://api.example.com --reason "provider restored"

croco jobs list --url http://localhost:3000/ops
```

`CROCO_JOBS_URL` can replace `--url`. `--json` prints machine-readable reports.

`croco jobs list` and `croco jobs show` return a non-zero exit code when the inspected jobs need
operator attention. This keeps failed, timed-out, retrying, and retry-exhausted executions visible
in CI or runbook checks.

## Failure Policy

Jobs v1 keeps the execution status model small and derives operator policy from it.

| Execution state                        | Jobs policy state | Needs attention | Recovery action |
| -------------------------------------- | ----------------- | --------------- | --------------- |
| `pending`                              | `pending`         | no              | wait            |
| `running`                              | `running`         | no              | wait            |
| `completed`                            | `succeeded`       | no              | none            |
| `cancelled`                            | `cancelled`       | no              | none            |
| `retrying`                             | `retrying`        | yes             | wait            |
| `timed_out`                            | `timed_out`       | yes             | retry or replay |
| `failed` with retry attempts exhausted | `retry_exhausted` | yes             | replay          |
| `failed` with a non-retryable error    | `dead_lettered`   | yes             | replay          |

Replay intentionally creates a new pending execution with `replayOf` pointing to the source
execution. It does not copy the original `idempotencyKey`, so operator replay cannot be swallowed by
deduplication.

## QStash Schedule Sync

`@croco/triggers-qstash` supports previewing declared cron schedule changes before applying them:

The scheduler instance is provided by the `@croco/triggers-qstash` adapter after credentials and
schedule declarations are configured.

```typescript no-check
const diff = await scheduler.sync({ mode: "dry-run" });
// diff.created / diff.updated / diff.deleted describe the planned changes.
// No QStash create/delete calls are made in dry-run mode.

await scheduler.sync({ mode: "apply" });

// Destructive cleanup is a separate, explicit operation. Only canonical schedules carrying this
// scheduler namespace's ownership label can be deleted.
await scheduler.sync({ mode: "apply-with-orphan-cleanup" });
```

`sync()` defaults to the non-destructive `apply` mode. It creates and updates schedules but preserves
owned orphans until `apply-with-orphan-cleanup` is selected. Returned details include `applied` and
stable migration or cleanup diagnostic codes, so operators can distinguish planned changes,
preserved legacy schedules, and mutations that were actually sent to QStash.

## Batch Checkpoints

`@croco/batch-core` stores checkpoints under a per-step key such as `import-users.cursor`.
Step names must contain a non-whitespace character and remain unique within each built job so these
checkpoint identities cannot collide. Invalid names fail during `Step` construction, and duplicate
names fail when `JobBuilder.build()` validates the complete job.
Single-step jobs keep the default behavior and complete the execution when the step finishes.
Multi-step jobs should keep the parent execution open for intermediate steps:

The executor, execution id, and step definitions come from the surrounding batch job runtime.

```typescript no-check
await chunkExecutor.execute(executionId, firstStep, { completeExecution: false });
await chunkExecutor.execute(executionId, finalStep, { startExecution: false });
```

## Generated SaaS Example

The SaaS golden path generated by `create-croco-app` now includes a smoke-tested `billing-sync`
background job. The demo flow creates an execution, records append-only logs, completes it, and
asserts the job is inspectable as `succeeded`. The generated API server also exposes those records
through `/ops/jobs`, so `croco jobs list --url http://localhost:3000/ops` talks to a real
`ExecutionManagerImpl`-backed surface.
