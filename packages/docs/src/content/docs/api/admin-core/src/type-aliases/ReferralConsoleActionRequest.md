---
editUrl: false
next: false
prev: false
title: "ReferralConsoleActionRequest"
---

> **ReferralConsoleActionRequest** = `object`

## Properties

### action

> `readonly` **action**: [`ReferralConsoleActionKind`](/api/admin-core/src/type-aliases/referralconsoleactionkind/)

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

### grantRefs?

> `readonly` `optional` **grantRefs?**: `Partial`\<`Record`\<`"referrer"` \| `"recipient"`, `string`\>\>

---

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

---

### policy?

> `readonly` `optional` **policy?**: `string`

---

### reason

> `readonly` **reason**: `string`

---

### returnIdempotencyKey?

> `readonly` `optional` **returnIdempotencyKey?**: `string`

---

### scope

> `readonly` **scope**: [`ReferralScope`](/api/referral-core/src/type-aliases/referralscope/) & `object`

#### Type Declaration

##### tenantId?

> `readonly` `optional` **tenantId?**: `string`

---

### side?

> `readonly` `optional` **side?**: [`ReferralBenefitSide`](/api/referral-core/src/type-aliases/referralbenefitside/)

---

### targetId

> `readonly` **targetId**: `string`
