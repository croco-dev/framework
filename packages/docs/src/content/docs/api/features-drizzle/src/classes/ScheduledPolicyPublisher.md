---
editUrl: false
next: false
prev: false
title: "ScheduledPolicyPublisher"
---

Connects durable policy schedules to Croco executions and a verified trigger delivery.

`schedule` writes the schedule before dispatching a trigger. A QStash/task adapter can
implement `PolicyTriggerDispatcher`; its verified webhook must call `handleVerifiedDelivery`.
`recoverDue` is safe after process restart because the schedule row and execution idempotency
key are durable. `handleVerifiedDelivery` claims the row before calling the core publisher,
and the publisher's command receipt is the final duplicate guard.

## Type Parameters

### TValue

`TValue` = `unknown`

## Constructors

### Constructor

> **new ScheduledPolicyPublisher**\<`TValue`\>(`options`): `ScheduledPolicyPublisher`\<`TValue`\>

#### Parameters

##### options

[`ScheduledPolicyPublisherOptions`](/api/features-drizzle/src/type-aliases/scheduledpolicypublisheroptions/)\<`TValue`\>

#### Returns

`ScheduledPolicyPublisher`\<`TValue`\>

## Methods

### handleVerifiedDelivery()

> **handleVerifiedDelivery**(`delivery`): `Promise`\<\{ `executionId?`: `string`; `receipt?`: [`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/); `schedule`: [`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/); `state`: `"completed"` \| `"duplicate"`; \}\>

Entry point for a trigger handler after provider signature and message identity verification.
The schedule claim and command receipt make duplicate deliveries and lease takeovers safe.

#### Parameters

##### delivery

[`PolicyScheduleDelivery`](/api/features-core/src/type-aliases/policyscheduledelivery/)

#### Returns

`Promise`\<\{ `executionId?`: `string`; `receipt?`: [`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/); `schedule`: [`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/); `state`: `"completed"` \| `"duplicate"`; \}\>

---

### recoverDue()

> **recoverDue**(`now?`, `limit?`): `Promise`\<readonly `Readonly`\<\{ `executionId`: `string`; `schedule`: [`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/); `triggerId?`: `string`; \}\>[]\>

Re-enqueues due rows after restart; it does not call the core publisher directly.

#### Parameters

##### now?

`Date` = `...`

##### limit?

`number` = `100`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `executionId`: `string`; `schedule`: [`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/); `triggerId?`: `string`; \}\>[]\>

---

### schedule()

> **schedule**(`command`): `Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>

#### Parameters

##### command

[`PolicyPublishCommand`](/api/features-core/src/type-aliases/policypublishcommand/)\<`TValue`\>

#### Returns

`Promise`\<[`PolicyScheduleRecord`](/api/features-core/src/type-aliases/policyschedulerecord/)\>
