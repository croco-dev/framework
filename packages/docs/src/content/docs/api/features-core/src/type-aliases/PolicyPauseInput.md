---
editUrl: false
next: false
prev: false
title: "PolicyPauseInput"
---

> **PolicyPauseInput**\<`TValue`\> = `object`

## Type Parameters

### TValue

`TValue` = `unknown`

## Properties

### command

> `readonly` **command**: `object`

#### action

> `readonly` **action**: `"pause"`

#### actor

> `readonly` **actor**: [`PolicyActor`](/api/features-core/src/type-aliases/policyactor/)

#### expectedRevision

> `readonly` **expectedRevision**: `number`

#### idempotencyKey

> `readonly` **idempotencyKey**: `string`

#### policyId

> `readonly` **policyId**: `string`

#### reason

> `readonly` **reason**: `string`

#### scope

> `readonly` **scope**: [`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

---

### expectedActiveVersion

> `readonly` **expectedActiveVersion**: `number`

---

### receipt

> `readonly` **receipt**: [`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/)

---

### retainedDraft?

> `readonly` `optional` **retainedDraft?**: [`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>

---

### revision

> `readonly` **revision**: [`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>
