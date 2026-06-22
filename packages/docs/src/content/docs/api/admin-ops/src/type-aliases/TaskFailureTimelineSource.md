---
editUrl: false
next: false
prev: false
title: "TaskFailureTimelineSource"
---

> **TaskFailureTimelineSource** = `object`

## Properties

### attempts?

> `readonly` `optional` **attempts?**: `number`

---

### completedAt?

> `readonly` `optional` **completedAt?**: `Date` \| `string`

---

### createdAt

> `readonly` **createdAt**: `Date` \| `string`

---

### error?

> `readonly` `optional` **error?**: `object`

#### code?

> `readonly` `optional` **code?**: `string`

#### message

> `readonly` **message**: `string`

#### retryable?

> `readonly` `optional` **retryable?**: `boolean`

#### stack?

> `readonly` `optional` **stack?**: `string`

---

### id

> `readonly` **id**: `string`

---

### maxAttempts?

> `readonly` `optional` **maxAttempts?**: `number`

---

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `unknown`\>

---

### parentId?

> `readonly` `optional` **parentId?**: `string`

---

### startedAt?

> `readonly` `optional` **startedAt?**: `Date` \| `string`

---

### status?

> `readonly` `optional` **status?**: `string`

---

### type

> `readonly` **type**: `string`
