---
editUrl: false
next: false
prev: false
title: "TaskDispatcherConformanceHarness"
---

> **TaskDispatcherConformanceHarness** = `object`

## Properties

### dispatcher

> `readonly` **dispatcher**: `object`

#### execute()

> **execute**(`taskId`, `payload`, `options?`): `Promise`\<\{ `messageId`: `string`; \}\>

##### Parameters

###### taskId

`string`

###### payload

`unknown`

###### options?

###### idempotencyKey?

`string`

##### Returns

`Promise`\<\{ `messageId`: `string`; \}\>

---

### messages

> `readonly` **messages**: readonly `object`[]
