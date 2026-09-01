---
editUrl: false
next: false
prev: false
title: "SuppressionStore"
---

## Extended by

- [`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/)

## Methods

### findActiveSuppressions()

> **findActiveSuppressions**(`input`): `Promise`\<readonly `Readonly`\<\{ `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `endpointId?`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `expiresAt?`: `Date`; `id`: `string`; `reason`: `string`; `recipientId?`: `string`; `source`: `string`; `tenantId`: `string`; `topic?`: `string`; \}\>[]\>

#### Parameters

##### input

[`EngagementSuppressionLookup`](/api/engagement-core/src/type-aliases/engagementsuppressionlookup/)

#### Returns

`Promise`\<readonly `Readonly`\<\{ `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `endpointId?`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `expiresAt?`: `Date`; `id`: `string`; `reason`: `string`; `recipientId?`: `string`; `source`: `string`; `tenantId`: `string`; `topic?`: `string`; \}\>[]\>

---

### saveSuppression()

> **saveSuppression**(`suppression`): `Promise`\<`void`\>

#### Parameters

##### suppression

[`EngagementSuppression`](/api/engagement-core/src/type-aliases/engagementsuppression/)

#### Returns

`Promise`\<`void`\>
