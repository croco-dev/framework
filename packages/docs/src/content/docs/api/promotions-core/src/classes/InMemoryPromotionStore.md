---
editUrl: false
next: false
prev: false
title: "InMemoryPromotionStore"
---

Single-process promotion store. The store itself serves as the transaction
handle, and `transact` serializes work through a mutex so concurrent
reserves observe each other's budget reservations, matching the atomicity
contract PostgreSQL implementations provide with row locks.

## Implements

- [`PromotionStore`](/api/promotions-core/src/interfaces/promotionstore/)
- [`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/)

## Constructors

### Constructor

> **new InMemoryPromotionStore**(): `InMemoryPromotionStore`

#### Returns

`InMemoryPromotionStore`

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

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`addBudgetReservation`](/api/promotions-core/src/interfaces/promotiontx/#addbudgetreservation)

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

`Date` = `...`

#### Returns

`Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)\>

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`compareAndSetClaimState`](/api/promotions-core/src/interfaces/promotiontx/#compareandsetclaimstate)

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

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`countSubjectClaims`](/api/promotions-core/src/interfaces/promotiontx/#countsubjectclaims)

---

### getClaim()

> **getClaim**(`claimId`): `Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

#### Parameters

##### claimId

`string`

#### Returns

`Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`getClaim`](/api/promotions-core/src/interfaces/promotiontx/#getclaim)

---

### getClaimByLogicalKey()

> **getClaimByLogicalKey**(`logicalKey`): `Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

#### Parameters

##### logicalKey

`string`

#### Returns

`Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`getClaimByLogicalKey`](/api/promotions-core/src/interfaces/promotiontx/#getclaimbylogicalkey)

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

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`getPolicy`](/api/promotions-core/src/interfaces/promotiontx/#getpolicy)

---

### getQuote()

> **getQuote**(`quoteId`): `Promise`\<[`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/) \| `null`\>

#### Parameters

##### quoteId

`string`

#### Returns

`Promise`\<[`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/) \| `null`\>

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`getQuote`](/api/promotions-core/src/interfaces/promotiontx/#getquote)

---

### latestPolicyVersion()

> **latestPolicyVersion**(`policyId`): `Promise`\<`number` \| `null`\>

#### Parameters

##### policyId

`string`

#### Returns

`Promise`\<`number` \| `null`\>

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`latestPolicyVersion`](/api/promotions-core/src/interfaces/promotiontx/#latestpolicyversion)

---

### listAudits()

> **listAudits**(): `Promise`\<readonly [`OfferAuditEntry`](/api/promotions-core/src/type-aliases/offerauditentry/)[]\>

Test and console support: read-only audit trail in insertion order.

#### Returns

`Promise`\<readonly [`OfferAuditEntry`](/api/promotions-core/src/type-aliases/offerauditentry/)[]\>

---

### listClaims()

> **listClaims**(`filter`): `Promise`\<readonly [`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)[]\>

#### Parameters

##### filter

[`ListClaimsFilter`](/api/promotions-core/src/type-aliases/listclaimsfilter/)

#### Returns

`Promise`\<readonly [`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)[]\>

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`listClaims`](/api/promotions-core/src/interfaces/promotiontx/#listclaims)

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

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`readBudgetReserved`](/api/promotions-core/src/interfaces/promotiontx/#readbudgetreserved)

---

### recordAudit()

> **recordAudit**(`entry`): `Promise`\<`void`\>

#### Parameters

##### entry

[`OfferAuditEntry`](/api/promotions-core/src/type-aliases/offerauditentry/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`recordAudit`](/api/promotions-core/src/interfaces/promotiontx/#recordaudit)

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

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`releaseBudgetReservation`](/api/promotions-core/src/interfaces/promotiontx/#releasebudgetreservation)

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

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`saveClaim`](/api/promotions-core/src/interfaces/promotiontx/#saveclaim)

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

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`savePolicy`](/api/promotions-core/src/interfaces/promotiontx/#savepolicy)

---

### saveQuote()

> **saveQuote**(`quote`): `Promise`\<`void`\>

#### Parameters

##### quote

[`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PromotionTx`](/api/promotions-core/src/interfaces/promotiontx/).[`saveQuote`](/api/promotions-core/src/interfaces/promotiontx/#savequote)

---

### transact()

> **transact**\<`T`\>(`work`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### work

(`tx`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

#### Implementation of

[`PromotionStore`](/api/promotions-core/src/interfaces/promotionstore/).[`transact`](/api/promotions-core/src/interfaces/promotionstore/#transact)
