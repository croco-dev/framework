---
editUrl: false
next: false
prev: false
title: "OfferConsoleActionRequest"
---

> **OfferConsoleActionRequest** = `object`

## Properties

### action

> `readonly` **action**: [`OfferConsoleActionKind`](/api/admin-core/src/type-aliases/offerconsoleactionkind/)

---

### actorId

> `readonly` **actorId**: `string`

---

### decision?

> `readonly` `optional` **decision?**: `"fulfilled"` \| `"rejected"`

---

### expectedGeneratedAt

> `readonly` **expectedGeneratedAt**: `Date`

---

### grantRef?

> `readonly` `optional` **grantRef?**: `string`

---

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

---

### reason

> `readonly` **reason**: `string`

---

### scope

> `readonly` **scope**: [`OfferConsoleSnapshot`](/api/admin-core/src/type-aliases/offerconsolesnapshot/)\[`"scope"`\]

---

### targetId

> `readonly` **targetId**: `string`
