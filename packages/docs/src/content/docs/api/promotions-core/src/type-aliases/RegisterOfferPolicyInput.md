---
editUrl: false
next: false
prev: false
title: "RegisterOfferPolicyInput"
---

> **RegisterOfferPolicyInput** = `object`

## Properties

### actorId

> `readonly` **actorId**: `string`

---

### allowStacking?

> `readonly` `optional` **allowStacking?**: `boolean`

---

### benefit

> `readonly` **benefit**: [`OfferBenefit`](/api/promotions-core/src/type-aliases/offerbenefit/)

---

### benefitCycleId

> `readonly` **benefitCycleId**: `string`

Explicit benefit cycle id. A fresh allowance always requires a new explicit
cycle id; changing `version` alone never resets per-subject counts.

---

### budget

> `readonly` **budget**: [`OfferBudget`](/api/promotions-core/src/type-aliases/offerbudget/)

---

### eligibility

> `readonly` **eligibility**: [`OfferEligibilityConditions`](/api/promotions-core/src/type-aliases/offereligibilityconditions/)

---

### endsAt

> `readonly` **endsAt**: `Date`

---

### familyId?

> `readonly` `optional` **familyId?**: `string`

Policy family; defaults to `id`. perSubjectLimit counts never reset on revision alone.

---

### id

> `readonly` **id**: `string`

---

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

---

### perSubjectLimit

> `readonly` **perSubjectLimit**: `number`

Required per-subject receipt limit; unlimited is never implied.

---

### reason

> `readonly` **reason**: `string`

---

### stackingGroup?

> `readonly` `optional` **stackingGroup?**: `string`

Claims sharing a group conflict unless `allowStacking` is true.

---

### startsAt

> `readonly` **startsAt**: `Date`

---

### version

> `readonly` **version**: `number`

Integer policy version; quotes and claims pin the version they were made under.
