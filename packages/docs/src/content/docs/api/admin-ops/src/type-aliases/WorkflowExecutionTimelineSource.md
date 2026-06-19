---
editUrl: false
next: false
prev: false
title: "WorkflowExecutionTimelineSource"
---

> **WorkflowExecutionTimelineSource** = `object`

## Properties

### completedAt?

> `readonly` `optional` **completedAt**: `Date` \| `string`

***

### createdAt

> `readonly` **createdAt**: `Date` \| `string`

***

### error?

> `readonly` `optional` **error**: `object`

#### code?

> `readonly` `optional` **code**: `string`

#### message

> `readonly` **message**: `string`

#### retryable?

> `readonly` `optional` **retryable**: `boolean`

***

### id

> `readonly` **id**: `string`

***

### metadata?

> `readonly` `optional` **metadata**: `Record`\<`string`, `unknown`\>

***

### startedAt?

> `readonly` `optional` **startedAt**: `Date` \| `string`

***

### status?

> `readonly` `optional` **status**: `string`

***

### steps?

> `readonly` `optional` **steps**: readonly `object`[]

***

### tenantId?

> `readonly` `optional` **tenantId**: `string`

***

### workflow

> `readonly` **workflow**: `string`
