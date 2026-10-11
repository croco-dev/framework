---
editUrl: false
next: false
prev: false
title: "OfferServiceOptions"
---

> **OfferServiceOptions** = `object`

## Properties

### clock?

> `readonly` `optional` **clock?**: () => `Date`

#### Returns

`Date`

---

### eligibility?

> `readonly` `optional` **eligibility?**: [`OfferEligibilityHook`](/api/promotions-core/src/type-aliases/offereligibilityhook/)

---

### fulfillment

> `readonly` **fulfillment**: [`OfferFulfillmentPort`](/api/promotions-core/src/interfaces/offerfulfillmentport/)

Fulfillment boundary for trial-credit grants; discount quotes complete without ledger movement.

---

### idGenerator?

> `readonly` `optional` **idGenerator?**: () => `string`

#### Returns

`string`

---

### quoteTtlMs?

> `readonly` `optional` **quoteTtlMs?**: `number`

---

### store

> `readonly` **store**: [`PromotionStore`](/api/promotions-core/src/interfaces/promotionstore/)
