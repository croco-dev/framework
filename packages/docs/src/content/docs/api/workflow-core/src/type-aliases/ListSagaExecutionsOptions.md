---
editUrl: false
next: false
prev: false
title: "ListSagaExecutionsOptions"
---

> **ListSagaExecutionsOptions** = `object`

## Properties

### limit?

> `readonly` `optional` **limit?**: `number`

Positive integer maximum number of executions to return.

---

### offset?

> `readonly` `optional` **offset?**: `number`

Non-negative integer number of executions to skip.

---

### replayOf?

> `readonly` `optional` **replayOf?**: `string` \| `null`

---

### sagaName?

> `readonly` `optional` **sagaName?**: `string`

---

### status?

> `readonly` `optional` **status?**: [`SagaExecutionStatus`](/api/workflow-core/src/type-aliases/sagaexecutionstatus/)
