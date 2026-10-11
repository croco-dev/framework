---
editUrl: false
next: false
prev: false
title: "PostgresPromotionStore"
---

PostgreSQL adapter for a Drizzle node-postgres execute/transaction boundary.

## Implements

- [`PromotionStore`](/api/promotions-core/src/interfaces/promotionstore/)

## Constructors

### Constructor

> **new PostgresPromotionStore**(`database`): `PostgresPromotionStore`

#### Parameters

##### database

[`PromotionPgDatabase`](/api/promotions-drizzle/src/interfaces/promotionpgdatabase/)

#### Returns

`PostgresPromotionStore`

## Methods

### getClaim()

> **getClaim**(`claimId`): `Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

#### Parameters

##### claimId

`string`

#### Returns

`Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

#### Implementation of

[`PromotionStore`](/api/promotions-core/src/interfaces/promotionstore/).[`getClaim`](/api/promotions-core/src/interfaces/promotionstore/#getclaim)

---

### getClaimByLogicalKey()

> **getClaimByLogicalKey**(`logicalKey`): `Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

#### Parameters

##### logicalKey

`string`

#### Returns

`Promise`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/) \| `null`\>

#### Implementation of

[`PromotionStore`](/api/promotions-core/src/interfaces/promotionstore/).[`getClaimByLogicalKey`](/api/promotions-core/src/interfaces/promotionstore/#getclaimbylogicalkey)

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

[`PromotionStore`](/api/promotions-core/src/interfaces/promotionstore/).[`getPolicy`](/api/promotions-core/src/interfaces/promotionstore/#getpolicy)

---

### getQuote()

> **getQuote**(`quoteId`): `Promise`\<[`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/) \| `null`\>

#### Parameters

##### quoteId

`string`

#### Returns

`Promise`\<[`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/) \| `null`\>

#### Implementation of

[`PromotionStore`](/api/promotions-core/src/interfaces/promotionstore/).[`getQuote`](/api/promotions-core/src/interfaces/promotionstore/#getquote)

---

### latestPolicyVersion()

> **latestPolicyVersion**(`policyId`): `Promise`\<`number` \| `null`\>

#### Parameters

##### policyId

`string`

#### Returns

`Promise`\<`number` \| `null`\>

#### Implementation of

[`PromotionStore`](/api/promotions-core/src/interfaces/promotionstore/).[`latestPolicyVersion`](/api/promotions-core/src/interfaces/promotionstore/#latestpolicyversion)

---

### listClaims()

> **listClaims**(`filter`): `Promise`\<readonly [`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)[]\>

#### Parameters

##### filter

[`ListClaimsFilter`](/api/promotions-core/src/type-aliases/listclaimsfilter/)

#### Returns

`Promise`\<readonly [`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)[]\>

#### Implementation of

[`PromotionStore`](/api/promotions-core/src/interfaces/promotionstore/).[`listClaims`](/api/promotions-core/src/interfaces/promotionstore/#listclaims)

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
