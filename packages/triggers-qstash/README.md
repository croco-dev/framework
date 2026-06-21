# @croco/triggers-qstash

QStash schedule synchronization and webhook handling for Croco triggers.

`@croco/triggers-qstash` connects Croco cron trigger metadata to Upstash QStash schedules and
verifies incoming QStash webhook requests before dispatching execution work.

## Install

```bash
pnpm add @croco/triggers-qstash @upstash/qstash
```

## Usage

```typescript
import { QStashScheduler, QStashTriggerHandler } from "@croco/triggers-qstash";
import { Client, Receiver } from "@upstash/qstash";

const client = new Client({ token: process.env.QSTASH_TOKEN });

const scheduler = new QStashScheduler({
  client,
  webhookUrl: "https://api.example.com/webhooks/qstash",
  schedulePrefix: "croco-trigger",
});

await scheduler.sync({ mode: "apply" });

const handler = new QStashTriggerHandler({
  receiver: new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  }),
  executionManager,
});
```

## Public API

| API                           | Description                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `QStashScheduler`             | Creates, updates, deletes, or dry-runs QStash schedules from triggers.                   |
| `QStashSchedulerOptions`      | Requires QStash client and public webhook URL; accepts prefix and mode.                  |
| `ScheduleSyncOptions`         | Per-sync mode override for `dry-run` or `apply`.                                         |
| `ScheduleSyncResult`          | Counts and details for created, updated, deleted, skipped, and failed schedules.         |
| `ScheduleSyncDetail`          | Per-schedule action, target, method, diagnostic code, retryability, and upstream status. |
| `QStashTriggerHandler`        | Verifies QStash signatures and dispatches the target trigger execution.                  |
| `QStashTriggerHandlerOptions` | Requires receiver and execution manager; accepts custom service resolver.                |
| `QStashWebhookPayload`        | Webhook payload shape expected from QStash schedule delivery.                            |
| `HandleResult`                | HTTP-oriented success/error response returned by the handler.                            |

## Failure Modes

- Schedule create/update/delete upstream failures are recorded in `ScheduleSyncDetail` with
  `code: "triggers-qstash/schedule-upstream-failed"`, redacted `error`, retryability, and optional
  upstream status.
- Invalid QStash signatures return `401` with `code: "triggers-qstash/invalid-signature"` before any
  execution dispatch occurs.
- Invalid JSON or malformed payloads return `400` with `code: "triggers-qstash/invalid-payload"`.
- Unknown target classes and methods return deterministic diagnostic-coded response bodies instead
  of generic strings.
- Target execution Problems preserve their original code and category in the webhook response body.
- Webhook response diagnostic codes are HTTP response contracts. They are not registered as public
  Problem registry entries unless they originate from a thrown Croco `Problem`.

## Conformance

`@croco/testing` provides `createQStashTriggerConformanceSuite()` and this package runs it in the
package test suite. Default CI uses mocked QStash schedule and receiver behavior only, so no QStash
credential is required.

Current conformance coverage:

- schedule sync payload and dry-run/apply evidence;
- invalid signature pre-dispatch behavior;
- verified webhook dispatch behavior;
- redacted schedule failure diagnostics;
- no-credential live-smoke gate skip.

Optional live smoke is gated by all of these env vars:

- `CROCO_LIVE_QSTASH=true`
- `QSTASH_TOKEN`
- `QSTASH_TRIGGER_WEBHOOK_URL`

```bash
pnpm --filter @croco/triggers-qstash test
pnpm --filter @croco/triggers-qstash typecheck
```

## Maturity

This package remains alpha. It has no-credential conformance coverage and documented opt-in live
smoke, but beta/production promotion still requires safe diagnostics/readiness evidence and recorded
real-backend and Worker smoke evidence.
