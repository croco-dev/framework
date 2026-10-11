---
editUrl: false
next: false
prev: false
title: "PromotionStore"
---

## Methods

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
