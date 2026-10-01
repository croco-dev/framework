---
editUrl: false
next: false
prev: false
title: "PromotionTx"
---

Transactional promotion storage boundary.

Implementations must make `transact` atomic: budget reservation, subject
counting, stacking checks, and claim insertion inside one `transact` call
observe each other, so concurrent reserves serialize instead of
overspending the budget. Claim state changes are compare-and-set guarded by
the expected states.

## Methods

### addBudgetReservation()

> **addBudgetReservation**(`policyId`, `version`, `amount`): `Promise`\<`void`\>

#### Parameters

##### policyId

`string`

##### version

`number`

##### amount

`string`

#### Returns

`Promise`\<`void`\>

---

### compareAndSetClaimState()

> **compareAndSetClaimState**(`claimId`, `expected`, `next`, `patch?`, `now?`): `Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)\>

#### Parameters

##### claimId

`string`

##### expected

readonly [`OfferClaimState`](/api/promotions-core/src/type-aliases/offerclaimstate/)[]

##### next

[`OfferClaimState`](/api/promotions-core/src/type-aliases/offerclaimstate/)

##### patch?

###### grantRef?

`string`

##### now?

`Date`

#### Returns

`Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)\>

---

### countSubjectClaims()

> **countSubjectClaims**(`familyId`, `benefitCycleId`, `subject`, `states`): `Promise`\<`number`\>

#### Parameters

##### familyId

`string`

##### benefitCycleId

`string`

##### subject

[`OfferSubject`](/api/promotions-core/src/type-aliases/offersubject/)

##### states

readonly [`OfferClaimState`](/api/promotions-core/src/type-aliases/offerclaimstate/)[]

#### Returns

`Promise`\<`number`\>

---

### getClaim()

> **getClaim**(`claimId`): `Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

#### Parameters

##### claimId

`string`

#### Returns

`Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

---

### getClaimByLogicalKey()

> **getClaimByLogicalKey**(`logicalKey`): `Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

#### Parameters

##### logicalKey

`string`

#### Returns

`Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

---

### getPolicy()

> **getPolicy**(`policyId`, `version`): `Promise`\<[`RegisteredOfferPolicy`](/api/promotions-core/src/type-aliases/registeredofferpolicy/) \| `null`\>

#### Parameters

##### policyId

`string`

##### version

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

### latestPolicyVersion()

> **latestPolicyVersion**(`policyId`): `Promise`\<`number` \| `null`\>

#### Parameters

##### policyId

`string`

#### Returns

`Promise`\<`number` \| `null`\>

---

### listClaims()

> **listClaims**(`filter`): `Promise`\<readonly [`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)[]\>

#### Parameters

##### filter

[`ListClaimsFilter`](/api/promotions-core/src/type-aliases/listclaimsfilter/)

#### Returns

`Promise`\<readonly [`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)[]\>

---

### readBudgetReserved()

> **readBudgetReserved**(`policyId`, `version`): `Promise`\<`string`\>

#### Parameters

##### policyId

`string`

##### version

`number`

#### Returns

`Promise`\<`string`\>

---

### recordAudit()

> **recordAudit**(`entry`): `Promise`\<`void`\>

#### Parameters

##### entry

[`OfferAuditEntry`](/api/promotions-core/src/type-aliases/offerauditentry/)

#### Returns

`Promise`\<`void`\>

---

### releaseBudgetReservation()

> **releaseBudgetReservation**(`policyId`, `version`, `amount`): `Promise`\<`void`\>

#### Parameters

##### policyId

`string`

##### version

`number`

##### amount

`string`

#### Returns

`Promise`\<`void`\>

---

### saveClaim()

> **saveClaim**(`claim`, `fingerprint`): `Promise`\<\{ `claim`: [`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/); `created`: `boolean`; \}\>

Persists a claim. A known logical key with an identical claim fingerprint
replays as `{ created: false }`; a different payload under the same key is
a duplicate-claim conflict.

#### Parameters

##### claim

[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)

##### fingerprint

`string`

#### Returns

`Promise`\<\{ `claim`: [`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/); `created`: `boolean`; \}\>

---

### savePolicy()

> **savePolicy**(`policy`): `Promise`\<\{ `created`: `boolean`; \}\>

Persists a registered policy. The same `(id, version)` with an identical
document replays as `{ created: false }`; a different document under the
same `(id, version)` is a conflict.

#### Parameters

##### policy

[`RegisteredOfferPolicy`](/api/promotions-core/src/type-aliases/registeredofferpolicy/)

#### Returns

`Promise`\<\{ `created`: `boolean`; \}\>

---

### saveQuote()

> **saveQuote**(`quote`): `Promise`\<`void`\>

#### Parameters

##### quote

[`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/)

#### Returns

`Promise`\<`void`\>
