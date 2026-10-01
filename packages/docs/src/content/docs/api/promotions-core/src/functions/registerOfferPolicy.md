---
editUrl: false
next: false
prev: false
title: "registerOfferPolicy"
---

> **registerOfferPolicy**(`input`, `now?`): [`RegisteredOfferPolicy`](/api/promotions-core/src/type-aliases/registeredofferpolicy/)

Registers an offer policy in code. Limits are mandatory, amounts are
canonicalized, and the returned document is a frozen snapshot: later
registrations never mutate confirmed quotes or claims made under it.

## Parameters

### input

[`RegisterOfferPolicyInput`](/api/promotions-core/src/type-aliases/registerofferpolicyinput/)

### now?

`Date` = `...`

## Returns

[`RegisteredOfferPolicy`](/api/promotions-core/src/type-aliases/registeredofferpolicy/)
