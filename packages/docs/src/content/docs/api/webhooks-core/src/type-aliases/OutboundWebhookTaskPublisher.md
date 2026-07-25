---
editUrl: false
next: false
prev: false
title: "OutboundWebhookTaskPublisher"
---

> **OutboundWebhookTaskPublisher** = `object`

## Methods

### publish()

> **publish**(`input`): `Promise`\<`void`\>

#### Parameters

##### input

###### contracts

\{ `execution`: [`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/); `outbox`: [`OutboxIntent`](/api/outbox-core/src/type-aliases/outboxintent/); `task`: [`TaskOptions`](/api/tasks-core/src/type-aliases/taskoptions/); \}

###### contracts.execution

[`CreateExecutionParams`](/api/execution-core/src/interfaces/createexecutionparams/)

###### contracts.outbox

[`OutboxIntent`](/api/outbox-core/src/type-aliases/outboxintent/)

###### contracts.task

[`TaskOptions`](/api/tasks-core/src/type-aliases/taskoptions/)

###### deliveryId

`string`

###### executionId

`string`

###### idempotencyKey

`string`

###### taskName

`"webhooks.outbound.deliver"`

###### visibleAt

`Date`

#### Returns

`Promise`\<`void`\>
