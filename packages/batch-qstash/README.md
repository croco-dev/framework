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

`executeChunk()` starts the execution, processes up to `step.chunkSize` records, checkpoints
checkpointable readers, publishes the next chunk only when more input remains, and completes the
execution when the step reaches the end of input.

## Public API

| API                             | Description                                                             |
| ------------------------------- | ----------------------------------------------------------------------- |
| `QStashChunkExecutor`           | Executes a batch chunk and schedules the next chunk through QStash.     |
| `QStashExecutorOptions`         | Requires `qstashClient` and a public `webhookUrl`.                      |
| `QStashBatchConfigProblem`      | Terminal Problem for missing execution manager, client, or webhook URL. |
| `QStashBatchValidationProblem`  | Terminal Problem for malformed publish URLs.                            |
| `QStashBatchPublishProblem`     | Redacted QStash publish failure with retryability and status evidence.  |
| `isRetryableQStashBatchError()` | Classifies transient QStash publish failures for diagnostics/tests.     |

## Failure Modes

- Missing execution manager, QStash client, or webhook URL throws `QStashBatchConfigProblem`.
- Non-HTTP(S) webhook URLs throw `QStashBatchValidationProblem`.
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
