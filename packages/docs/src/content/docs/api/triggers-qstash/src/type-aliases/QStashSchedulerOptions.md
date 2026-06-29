---
editUrl: false
next: false
prev: false
title: "QStashSchedulerOptions"
---

> **QStashSchedulerOptions** = `object`

Configuration options for QStashScheduler.

## Properties

### client

> `readonly` **client**: `Client`

QStash HTTP client instance.

***

### executionManager?

> `readonly` `optional` **executionManager?**: [`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/)

Optional execution manager for dispatching executions.
If provided, the scheduler can create executions when syncing schedules.

***

### mode?

> `readonly` `optional` **mode?**: [`ScheduleSyncMode`](/api/triggers-qstash/src/type-aliases/schedulesyncmode/)

Default sync mode. Defaults to 'apply' for backwards compatibility.

***

### schedulePrefix?

> `readonly` `optional` **schedulePrefix?**: `string`

Optional prefix for schedule names in QStash.
Defaults to 'croco-trigger'.

Used to uniquely identify schedules created by this scheduler.

***

### webhookUrl

> `readonly` **webhookUrl**: `string`

Base URL for the webhook endpoint that receives QStash triggers.
This URL will be called when a scheduled job is triggered.

Example: 'https://api.example.com/webhooks/qstash'
