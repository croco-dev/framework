---
editUrl: false
next: false
prev: false
title: "OfferQuote"
---

> **OfferQuote** = `object`

## Properties

### benefit

> `readonly` **benefit**: [`OfferBenefit`](/api/promotions-core/src/type-aliases/offerbenefit/)

Benefit snapshot pinned at quote time; later policy revisions never rewrite it.

---

### benefitCycleId

> `readonly` **benefitCycleId**: `string`

---

### costAmount

> `readonly` **costAmount**: `string`

---

### currency?

> `readonly` `optional` **currency?**: `string`

---

### eligibilityRevision

> `readonly` **eligibilityRevision**: `string`

---

### expiresAt

> `readonly` **expiresAt**: `Date`

---

### faceAmount

> `readonly` **faceAmount**: `string`

Locked face value and actual cost, pinned with amount and unit.

---

### familyId

> `readonly` **familyId**: `string`

---

### id

> `readonly` **id**: `string`

---

### policyId

> `readonly` **policyId**: `string`

---

### policyVersion

> `readonly` **policyVersion**: `number`

---

### quotedAt

> `readonly` **quotedAt**: `Date`

---

### subject

> `readonly` **subject**: [`OfferSubject`](/api/promotions-core/src/type-aliases/offersubject/)
