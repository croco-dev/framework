---
editUrl: false
next: false
prev: false
title: "QStashScheduler"
---

QStashScheduler manages cron-based triggers using QStash's scheduling API.

This scheduler reads

## Cron

metadata from triggerRegistry and syncs
the schedules with QStash. It handles:

- Creating new schedules for

## Cron

decorated methods

- Updating existing schedules when cron expressions change
- Deleting schedules that are no longer in code
- Generating unique schedule IDs based on target class and method name

## Constructors

### Constructor

> **new QStashScheduler**(`options`): `QStashScheduler`

#### Parameters

##### options

[`QStashSchedulerOptions`](/api/triggers-qstash/src/type-aliases/qstashscheduleroptions/)

#### Returns

`QStashScheduler`

## Methods

### getCronTrigger()

> **getCronTrigger**(`target`, `methodName`): [`CronTriggerMetadata`](/api/triggers-core/src/type-aliases/crontriggermetadata/) \| `undefined`

Get a single cron trigger by class and method name.

Useful for testing and debugging.

#### Parameters

##### target

`object`

##### methodName

`string`

#### Returns

[`CronTriggerMetadata`](/api/triggers-core/src/type-aliases/crontriggermetadata/) \| `undefined`

---

### sync()

> **sync**(`options?`): `Promise`\<[`ScheduleSyncResult`](/api/triggers-qstash/src/type-aliases/schedulesyncresult/)\>

Sync all cron triggers with QStash.

This method compares the schedules defined in code (@Cron decorators)
with the schedules currently in QStash, and creates/updates/deletes as needed.

#### Parameters

##### options?

[`ScheduleSyncOptions`](/api/triggers-qstash/src/type-aliases/schedulesyncoptions/) = `{}`

#### Returns

`Promise`\<[`ScheduleSyncResult`](/api/triggers-qstash/src/type-aliases/schedulesyncresult/)\>

Sync result with counts and details
