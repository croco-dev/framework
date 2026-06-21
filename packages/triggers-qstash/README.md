# @croco/triggers-qstash

QStash schedule synchronization and webhook handling for Croco triggers.

`@croco/triggers-qstash` connects Croco trigger definitions to Upstash QStash schedules
and verifies incoming QStash webhook requests before dispatching execution work.

## Public API

- `QStashScheduler` - synchronizes registered cron triggers with QStash schedules.
- `QStashTriggerHandler` - verifies and dispatches QStash webhook payloads.
- Scheduler, sync, webhook, and handler option types.

## Usage

```typescript
import { QStashScheduler } from "@croco/triggers-qstash";

const scheduler = new QStashScheduler({
  client,
  triggerRegistry,
});

await scheduler.sync();
```

## Verification

```bash
pnpm --filter @croco/triggers-qstash test
pnpm --filter @croco/triggers-qstash typecheck
```
