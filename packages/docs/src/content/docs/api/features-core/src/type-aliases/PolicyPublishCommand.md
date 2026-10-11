---
editUrl: false
next: false
prev: false
title: "PolicyPublishCommand"
---

> **PolicyPublishCommand**\<`TValue`\> = `object`

## Type Parameters

### TValue

`TValue` = `unknown`

## Properties

### actor

> `readonly` **actor**: [`PolicyActor`](/api/features-core/src/type-aliases/policyactor/)

---

### effectiveAt?

> `readonly` `optional` **effectiveAt?**: `string`

---

### expectedRevision

> `readonly` **expectedRevision**: `number`

---

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

---

### policyId

> `readonly` **policyId**: `string`

---

### reason

> `readonly` **reason**: `string`

---

### reviewHash

> `readonly` **reviewHash**: `string`

---

### scope

> `readonly` **scope**: [`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

---

### value?

> `readonly` `optional` **value?**: `TValue`
