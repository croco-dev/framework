---
editUrl: false
next: false
prev: false
title: "SagaStepExecutionRecord"
---

> **SagaStepExecutionRecord** = `object`

## Properties

### attempts

> `readonly` **attempts**: `number`

---

### compensationCompletedAt?

> `readonly` `optional` **compensationCompletedAt?**: `Date`

---

### compensationError?

> `readonly` `optional` **compensationError?**: [`SagaFailure`](/api/workflow-core/src/type-aliases/sagafailure/)

---

### compensationResult?

> `readonly` `optional` **compensationResult?**: `unknown`

---

### compensationStartedAt?

> `readonly` `optional` **compensationStartedAt?**: `Date`

---

### completedAt?

> `readonly` `optional` **completedAt?**: `Date`

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

### input

> `readonly` **input**: `unknown`

---

### maxAttempts

> `readonly` **maxAttempts**: `number`

---

### outboxMessages

> `readonly` **outboxMessages**: readonly [`SagaOutboxRecord`](/api/workflow-core/src/type-aliases/sagaoutboxrecord/)[]

---

### result?

> `readonly` `optional` **result?**: `unknown`

---

### startedAt?

> `readonly` `optional` **startedAt?**: `Date`

---

### status

> `readonly` **status**: [`SagaStepStatus`](/api/workflow-core/src/type-aliases/sagastepstatus/)
