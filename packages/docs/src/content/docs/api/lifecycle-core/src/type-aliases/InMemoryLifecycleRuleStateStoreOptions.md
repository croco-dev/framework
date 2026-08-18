---
editUrl: false
next: false
prev: false
title: "InMemoryLifecycleRuleStateStoreOptions"
---

> **InMemoryLifecycleRuleStateStoreOptions** = `object`

## Properties

### commandTtlMs?

> `readonly` `optional` **commandTtlMs?**: `number`

***

### now?

> `readonly` `optional` **now?**: `Clock`

Supplies the logical clock used for command retention and execution lease expiry.
When this clock does not advance with wall time, provide scheduleExecutionClaimWake
on the same logical timeline.

***

### scheduleExecutionClaimWake?

> `readonly` `optional` **scheduleExecutionClaimWake?**: `ExecutionClaimWakeScheduler`

Schedules an execution-lease expiry wakeup and returns a cancellation callback.
The default scheduler uses wall-clock timers.
