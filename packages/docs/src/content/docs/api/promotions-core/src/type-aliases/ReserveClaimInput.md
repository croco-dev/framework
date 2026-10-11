---
editUrl: false
next: false
prev: false
title: "ReserveClaimInput"
---

> **ReserveClaimInput** = `object`

## Properties

### claimId?

> `readonly` `optional` **claimId?**: `string`

---

### logicalKey

> `readonly` **logicalKey**: `string`

---

### now?

> `readonly` `optional` **now?**: `Date`

---

### provider?

> `readonly` `optional` **provider?**: `string`

Provider the discount is fulfilled through; required for discount benefits.

---

### quoteId

> `readonly` **quoteId**: `string`

---

### subject

> `readonly` **subject**: [`OfferSubject`](/api/promotions-core/src/type-aliases/offersubject/)

Authenticated caller; must equal the quoted subject or the claim is rejected.
