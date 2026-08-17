# @croco/batch-qstash

QStash-backed chunk executor for Croco batch steps.

## Install

```bash
pnpm add @croco/batch-qstash @upstash/qstash
```

## Usage

```typescript
import { QStashChunkExecutor } from "@croco/batch-qstash";
import { Client } from "@upstash/qstash";

const executor = new QStashChunkExecutor(executionManager, {
  qstashClient: new Client({ token: process.env.QSTASH_TOKEN }),
  webhookUrl: "https://api.example.com/batch/next",
});

const result = await executor.executeChunk("execution-1", step);
```

`QStashChunkExecutor` reads the configured continuation lease duration from the execution manager
and rejects `heartbeatIntervalMs` values that are greater than or equal to that lease. Keep the
heartbeat comfortably below expiry; the defaults use a 10-second heartbeat with a 30-second lease,
and one-third of the lease duration is the recommended operational target.

QStash distributed continuations require a reader that implements both `ItemReader` and
`Checkpointable`. Each webhook delivery reconstructs the reader, so the checkpoint must fully
capture the cursor position. A reader that lacks `getCheckpoint` or `restoreCheckpoint` is
rejected with `QStashBatchConfigProblem` before a continuation claim is acquired.

QStash steps also require a writer that implements both the generic `ItemWriter.write()` contract and
`QStashIdempotentWriter.writeIdempotent()`. Use `processingToken` as the provider or database
idempotency key; it remains stable if an expired continuation lease is reclaimed.

```typescript
import type { ItemWriter } from "@croco/batch-core";
import type { QStashIdempotentWriteContext, QStashIdempotentWriter } from "@croco/batch-qstash";

class OrderWriter implements ItemWriter<Order>, QStashIdempotentWriter<Order> {
  async write(items: Order[]): Promise<void> {
    await orders.insert(items);
  }

  async writeIdempotent(items: Order[], context: QStashIdempotentWriteContext): Promise<void> {
    await orders.insertOnce(items, { idempotencyKey: context.processingToken });
  }
}
```

This dual interface preserves compatibility with generic batch executors while making the QStash
external side-effect boundary explicitly idempotent. A plain `ItemWriter` is rejected before a
continuation claim is acquired.

`executeChunk()` claims the initial or delivered continuation token, processes up to
`step.chunkSize` records, checkpoints checkpointable readers, publishes the next token only when
more input remains, and completes the execution when the step reaches the end of input. The webhook
handler must pass the published token back to the executor:

```typescript
await executor.executeChunk(body.executionId, step, {
  continuationToken: body.continuationToken,
});
```

## Public API

| API                             | Description                                                                |
| ------------------------------- | -------------------------------------------------------------------------- |
| `QStashChunkExecutor`           | Executes a batch chunk and schedules the next chunk through QStash.        |
| `QStashStep`                    | Batch step requiring a checkpointable reader and idempotent QStash writer. |
| `QStashIdempotentWriter`        | External writer capability fenced by a stable processing token.            |
| `QStashChunkDelivery`           | Continuation token and optional worker identity from the webhook.          |
| `QStashExecutorOptions`         | Requires `qstashClient` and a public `webhookUrl`.                         |
| `QStashBatchConfigProblem`      | Terminal Problem for missing execution manager, client, or webhook URL.    |
| `QStashBatchValidationProblem`  | Terminal Problem for malformed publish URLs or invalid chunk sizes.        |
| `QStashBatchPublishProblem`     | Redacted QStash publish failure with retryability and status evidence.     |
| `isRetryableQStashBatchError()` | Classifies transient QStash publish failures for diagnostics/tests.        |

## Failure Modes

- Missing execution manager, QStash client, or webhook URL throws `QStashBatchConfigProblem`.
- Execution managers without atomic continuation support, steps without a checkpointable reader,
  and steps without an idempotent writer fail before processing begins.
- Duplicate stale tokens return a zero-work `stale` result; an actively owned token throws
  `execution/continuation-conflict` so QStash can retry it.
- Non-HTTP(S) webhook URLs throw `QStashBatchValidationProblem`.
- `step.chunkSize` must be a positive safe integer and is rejected before a continuation claim.
- Next-chunk publish failures throw `QStashBatchPublishProblem`.
- Upstream status `408`, `429`, and `5xx` are marked retryable. Terminal upstream failures are marked
  non-retryable.
- Error detail is redacted for token, secret, and credential-like values before it reaches the
  Problem detail.
- If `Step.classifyFailure` is present, local chunk execution failure records preserve its retryable
  and code classification before the original error is rethrown.
- If `Step.classifyFailure` itself throws, the original error is rethrown and execution failure
  metadata uses `batch-core/failure-classification-failed` so operators can distinguish processing
  failure from classifier failure.

## Conformance

`@croco/testing` provides `createQStashBatchConformanceSuite()` and this package runs it in the
package test suite. Default CI uses a mocked QStash client only, so no QStash credential is required.

Current conformance coverage:

- terminal chunk completion;
- next-chunk publish envelope and idempotency key evidence;
- execution failure retryability preservation;
- retryable and terminal upstream Problem classification;
- no-credential live-smoke gate skip.

Optional live smoke is gated by all of these env vars:

- `CROCO_LIVE_QSTASH=true`
- `QSTASH_TOKEN`
- `QSTASH_BATCH_WEBHOOK_URL`

```bash
pnpm --filter @croco/batch-qstash test
pnpm --filter @croco/batch-qstash typecheck
```

## Maturity

This package remains alpha. It has no-credential conformance coverage and documented opt-in live
smoke, but beta/production promotion still requires safe diagnostics/readiness evidence and recorded
real-backend and Worker smoke evidence.
