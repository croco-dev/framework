---
editUrl: false
next: false
prev: false
title: "SagaRunResult"
---

> **SagaRunResult** = `object`

## Properties

### definition

> `readonly` **definition**: [`SagaDefinition`](/api/workflow-core/src/type-aliases/sagadefinition/)

---

### execution

> `readonly` **execution**: [`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)

---

### executionId

> `readonly` **executionId**: `string`

---

### result?

> `readonly` `optional` **result?**: `unknown`

---

### reused

> `readonly` **reused**: `boolean`

---

### steps

> `readonly` **steps**: readonly [`SagaStepResult`](/api/workflow-core/src/type-aliases/sagastepresult/)[]
