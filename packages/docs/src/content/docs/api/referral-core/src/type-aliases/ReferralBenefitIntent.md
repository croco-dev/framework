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
