---
editUrl: false
next: false
prev: false
title: "OfferFulfillmentPort"
---

External fulfillment boundary. `fulfill` must be idempotent on
`idempotencyKey`: a retry after response loss returns the original grant
instead of paying twice. `check` reports a previously completed grant or
null when nothing durable is visible; it never pays.

## Methods

### check()

> **check**(`input`): `Promise`\<\{ `grantRef`: `string`; \} \| `null`\>

#### Parameters

##### input

###### claim

[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)

###### idempotencyKey

`string`

###### subject

[`OfferSubject`](/api/promotions-core/src/type-aliases/offersubject/)

#### Returns

`Promise`\<\{ `grantRef`: `string`; \} \| `null`\>

---

### fulfill()

> **fulfill**(`input`): `Promise`\<[`FulfillmentResult`](/api/promotions-core/src/type-aliases/fulfillmentresult/)\>

#### Parameters

##### input

###### claim

[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)

###### idempotencyKey

`string`

###### policy

[`RegisteredOfferPolicy`](/api/promotions-core/src/type-aliases/registeredofferpolicy/)

###### provider?

`string`

###### quote

[`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/)

###### subject

[`OfferSubject`](/api/promotions-core/src/type-aliases/offersubject/)

#### Returns

`Promise`\<[`FulfillmentResult`](/api/promotions-core/src/type-aliases/fulfillmentresult/)\>
