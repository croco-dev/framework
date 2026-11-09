---
editUrl: false
next: false
prev: false
title: "SqsTaskHandlerOptions"
---

> **SqsTaskHandlerOptions** = `object`

## Properties

### application

> `readonly` **application**: [`ApplicationRuntime`](/api/framework-module/src/classes/applicationruntime/)

---

### executionManager

> `readonly` **executionManager**: [`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/)

---

### flush

> `readonly` **flush**: () => `Promise`\<`void`\>

Await app-owned telemetry flush before acknowledging a batch. A failure rejects the batch.

#### Returns

`Promise`\<`void`\>

---

### queueArn

> `readonly` **queueArn**: `string`

Exact trusted mapping identity; the Lambda function must not expose a public invoke endpoint.

---

### registry

> `readonly` **registry**: [`TaskRegistry`](/api/tasks-core/src/classes/taskregistry/)

---

### tenantId

> `readonly` **tenantId**: `string`

Trusted tenant authority for this queue, never derived from message headers or payload.
