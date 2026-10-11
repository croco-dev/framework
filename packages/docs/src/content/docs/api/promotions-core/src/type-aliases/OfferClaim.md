---
editUrl: false
next: false
prev: false
title: "OfferClaim"
---

> **OfferClaim** = `object`

## Properties

### benefit

> `readonly` **benefit**: [`OfferBenefit`](/api/promotions-core/src/type-aliases/offerbenefit/)

Benefit snapshot pinned from the quote; immune to later policy revisions.

---

### benefitCycleId

> `readonly` **benefitCycleId**: `string`

---

### budgetReservation

> `readonly` **budgetReservation**: `object`

Budget locked by this claim until it reaches a terminal state.

#### amount

> `readonly` **amount**: `string`

---

### costAmount

> `readonly` **costAmount**: `string`

---

### createdAt

> `readonly` **createdAt**: `Date`

---

### currency?

> `readonly` `optional` **currency?**: `string`

---

### faceAmount

> `readonly` **faceAmount**: `string`

---

### familyId

> `readonly` **familyId**: `string`

---

### grantRef?

> `readonly` `optional` **grantRef?**: `string`

---

### id

> `readonly` **id**: `string`

---

### logicalKey

> `readonly` **logicalKey**: `string`

---

### policyId

> `readonly` **policyId**: `string`

---

### policyVersion

> `readonly` **policyVersion**: `number`

---

### quoteId

> `readonly` **quoteId**: `string`

---

### stackingGroup?

> `readonly` `optional` **stackingGroup?**: `string`

---

### state

> `readonly` **state**: [`OfferClaimState`](/api/promotions-core/src/type-aliases/offerclaimstate/)

---

### subject

> `readonly` **subject**: [`OfferSubject`](/api/promotions-core/src/type-aliases/offersubject/)

---

### updatedAt

> `readonly` **updatedAt**: `Date`
