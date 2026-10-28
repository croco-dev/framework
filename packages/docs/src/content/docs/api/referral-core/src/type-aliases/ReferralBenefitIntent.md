---
editUrl: false
next: false
prev: false
title: "ReferralBenefitIntent"
---

> **ReferralBenefitIntent** = `object`

## Properties

### accountRef?

> `readonly` `optional` **accountRef?**: `string`

---

### attributionId

> `readonly` **attributionId**: `string`

---

### benefit

> `readonly` **benefit**: [`ReferralBenefit`](/api/referral-core/src/type-aliases/referralbenefit/)

---

### createdAt

> `readonly` **createdAt**: `Date`

---

### fulfillmentAttempt?

> `readonly` `optional` **fulfillmentAttempt?**: `number`

Monotonic owner of an external fulfillment attempt; absent legacy values mean zero.

---

### id

> `readonly` **id**: `string`

---

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

---

### logicalKey

> `readonly` **logicalKey**: `string`

Deterministic key: `referral-benefit:<attributionId>:<side>`.

---

### reason?

> `readonly` `optional` **reason?**: `string`

---

### receipt?

> `readonly` `optional` **receipt?**: `string`

---

### returnOperation?

> `readonly` `optional` **returnOperation?**: `object`

One durable compensating operation per benefit, independent of caller retry keys.

#### actorId

> `readonly` **actorId**: `string`

#### failureReason?

> `readonly` `optional` **failureReason?**: `string`

#### idempotencyKey

> `readonly` **idempotencyKey**: `string`

#### policy

> `readonly` **policy**: `string`

#### reason

> `readonly` **reason**: `string`

#### receipt?

> `readonly` `optional` **receipt?**: `string`

#### status

> `readonly` **status**: `"returning"` \| `"unknown"` \| `"returned"`

---

### side

> `readonly` **side**: [`ReferralBenefitSide`](/api/referral-core/src/type-aliases/referralbenefitside/)

---

### status

> `readonly` **status**: [`ReferralBenefitIntentStatus`](/api/referral-core/src/type-aliases/referralbenefitintentstatus/)

---

### subject

> `readonly` **subject**: [`ReferralSubject`](/api/referral-core/src/type-aliases/referralsubject/)

---

### updatedAt

> `readonly` **updatedAt**: `Date`
