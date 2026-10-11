---
editUrl: false
next: false
prev: false
title: "OfferService"
---

## Constructors

### Constructor

> **new OfferService**(`options`): `OfferService`

#### Parameters

##### options

[`OfferServiceOptions`](/api/promotions-core/src/type-aliases/offerserviceoptions/)

#### Returns

`OfferService`

## Methods

### evaluateEligibility()

> **evaluateEligibility**(`input`): `Promise`\<[`EligibilityVerdict`](/api/promotions-core/src/type-aliases/eligibilityverdict/)\>

#### Parameters

##### input

###### now?

`Date`

###### policyId

`string`

###### subject

[`OfferSubject`](/api/promotions-core/src/type-aliases/offersubject/)

###### version?

`number`

#### Returns

`Promise`\<[`EligibilityVerdict`](/api/promotions-core/src/type-aliases/eligibilityverdict/)\>

---

### expireOverdueClaims()

> **expireOverdueClaims**(`input`): `Promise`\<readonly [`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)[]\>

Expires reserved claims whose quotes lapsed. Re-reading never extends an
expiry, and claims with an unclear grant outcome keep their locked budget
until reconciliation or an operator decision.

#### Parameters

##### input

###### limit?

`number`

###### now?

`Date`

#### Returns

`Promise`\<readonly [`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)[]\>

---

### fulfillClaim()

> **fulfillClaim**(`input`): `Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)\>

Fulfills a reserved claim. Trial-credit grants run through the fulfillment
port with a deterministic idempotency key, so retries after response loss
confirm the original grant instead of paying twice. Discount quotes
complete as recorded entitlements without ledger movement. A port that
reports `unknown` — or throws after possibly committing — leaves the claim
`indeterminate` with its budget locked for later reconciliation.

#### Parameters

##### input

###### claimId

`string`

###### now?

`Date`

###### provider?

`string`

#### Returns

`Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)\>

---

### getClaim()

> **getClaim**(`claimId`): `Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

#### Parameters

##### claimId

`string`

#### Returns

`Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

---

### getPolicy()

> **getPolicy**(`policyId`, `version?`): `Promise`\<[`RegisteredOfferPolicy`](/api/promotions-core/src/type-aliases/registeredofferpolicy/) \| `null`\>

#### Parameters

##### policyId

`string`

##### version?

`number`

#### Returns

`Promise`\<[`RegisteredOfferPolicy`](/api/promotions-core/src/type-aliases/registeredofferpolicy/) \| `null`\>

---

### getQuote()

> **getQuote**(`quoteId`): `Promise`\<[`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/) \| `null`\>

#### Parameters

##### quoteId

`string`

#### Returns

`Promise`\<[`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/) \| `null`\>

---

### quoteOffer()

> **quoteOffer**(`input`): `Promise`\<[`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/)\>

#### Parameters

##### input

[`QuoteOfferInput`](/api/promotions-core/src/type-aliases/quoteofferinput/)

#### Returns

`Promise`\<[`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/)\>

---

### reconcileClaim()

> **reconcileClaim**(`input`): `Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)\>

Reconciles a claim whose grant outcome is unclear. A visible grant
completes the claim; otherwise `fulfilling` claims safely retry the
idempotent grant, while `indeterminate` claims stay locked for an explicit
operator decision. Reconciliation never releases the budget or pays again
on its own.

#### Parameters

##### input

###### claimId

`string`

###### now?

`Date`

#### Returns

`Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)\>

---

### recoverPendingClaims()

> **recoverPendingClaims**(`input`): `Promise`\<readonly [`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)[]\>

Lists reserved, fulfilling, and indeterminate claims so restarts can resume them.

#### Parameters

##### input

###### limit?

`number`

#### Returns

`Promise`\<readonly [`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)[]\>

---

### registerPolicy()

> **registerPolicy**(`input`): `Promise`\<\{ `created`: `boolean`; `policy`: [`RegisteredOfferPolicy`](/api/promotions-core/src/type-aliases/registeredofferpolicy/); \}\>

#### Parameters

##### input

[`RegisterOfferPolicyInput`](/api/promotions-core/src/type-aliases/registerofferpolicyinput/)

#### Returns

`Promise`\<\{ `created`: `boolean`; `policy`: [`RegisteredOfferPolicy`](/api/promotions-core/src/type-aliases/registeredofferpolicy/); \}\>

---

### reserveClaim()

> **reserveClaim**(`input`): `Promise`\<[`ReserveClaimResult`](/api/promotions-core/src/type-aliases/reserveclaimresult/)\>

Reserves a claim for a quoted offer. The quoted subject, benefit snapshot,
and amounts are taken from the stored quote: client-supplied customers or
amounts are never trusted. Eligibility is rechecked live, so a customer
who lost eligibility after exposure is rejected here.

#### Parameters

##### input

[`ReserveClaimInput`](/api/promotions-core/src/type-aliases/reserveclaiminput/)

#### Returns

`Promise`\<[`ReserveClaimResult`](/api/promotions-core/src/type-aliases/reserveclaimresult/)\>

---

### resolveIndeterminateClaim()

> **resolveIndeterminateClaim**(`input`): `Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)\>

Operator adjustment for indeterminate claims: explicitly complete with a
verified grant reference, or reject and release the locked budget. Every
decision preserves actor, reason, and an audit trail.

#### Parameters

##### input

###### actorId

`string`

###### claimId

`string`

###### decision

`"fulfilled"` \| `"rejected"`

###### grantRef?

`string`

###### idempotencyKey?

`string`

###### now?

`Date`

###### reason

`string`

#### Returns

`Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)\>
