---
editUrl: false
next: false
prev: false
title: "SagaExecution"
---

> **SagaExecution** = `object`

## Properties

### compensationFailures

> `readonly` **compensationFailures**: readonly [`SagaFailure`](/api/workflow-core/src/type-aliases/sagafailure/)[]

---

### completedAt?

> `readonly` `optional` **completedAt?**: `Date`

---

### createdAt

> `readonly` **createdAt**: `Date`

---

### error?

> `readonly` `optional` **error?**: [`SagaFailure`](/api/workflow-core/src/type-aliases/sagafailure/)

---

### id

> `readonly` **id**: `string`

---

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `string`

---

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `unknown`\>

---

### payload

> `readonly` **payload**: `unknown`

---

### replayOf?

> `readonly` `optional` **replayOf?**: `string`

---

### result?

> `readonly` `optional` **result?**: `unknown`

---

### sagaName

> `readonly` **sagaName**: `string`

---

### startedAt?

> `readonly` `optional` **startedAt?**: `Date`

---

### status

> `readonly` **status**: [`SagaExecutionStatus`](/api/workflow-core/src/type-aliases/sagaexecutionstatus/)

---

### steps

> `readonly` **steps**: readonly [`SagaStepExecutionRecord`](/api/workflow-core/src/type-aliases/sagastepexecutionrecord/)[]
