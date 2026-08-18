---
editUrl: false
next: false
prev: false
title: "ScheduleSyncDetail"
---

> **ScheduleSyncDetail** = `object`

Detail of a single schedule sync operation.

## Properties

### action

> `readonly` **action**: `"created"` \| `"updated"` \| `"deleted"` \| `"skipped"` \| `"failed"`

---

### applied

> `readonly` **applied**: `boolean`

---

### code?

> `readonly` `optional` **code?**: `string`

---

### currentExpression?

> `readonly` `optional` **currentExpression?**: `string`

---

### error?

> `readonly` `optional` **error?**: `string`

Error message if operation failed.

---

### expression

> `readonly` **expression**: `string`

Cron expression.

---

### method

> `readonly` **method**: `string`

Target method name.

---

### name

> `readonly` **name**: `string`

Schedule name/ID.

---

### retryable?

> `readonly` `optional` **retryable?**: `boolean`

---

### target

> `readonly` **target**: `string`

Target class name.

---

### upstreamStatus?

> `readonly` `optional` **upstreamStatus?**: `number`
