---
editUrl: false
next: false
prev: false
title: "EngagementDeliveryEventStore"
---

## Extended by

- [`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/)

## Methods

### listByDispatch()

> **listByDispatch**(`tenantId`, `dispatchId`): `Promise`\<readonly `Readonly`\<\{ `dispatchId`: `string`; `endpointId`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `id`: `string`; `occurredAt`: `Date`; `provider`: `string`; `providerEventId`: `string`; `recordedAt`: `Date`; `tenantId`: `string`; `type`: `"accepted"` \| `"delivered"` \| `"opened"` \| `"clicked"` \| `"bounced"` \| `"complained"` \| `"unsubscribed"` \| `"token-invalid"` \| `"expired"` \| `"failed"`; \}\>[]\>

#### Parameters

##### tenantId

`string`

##### dispatchId

`string`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `dispatchId`: `string`; `endpointId`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `id`: `string`; `occurredAt`: `Date`; `provider`: `string`; `providerEventId`: `string`; `recordedAt`: `Date`; `tenantId`: `string`; `type`: `"accepted"` \| `"delivered"` \| `"opened"` \| `"clicked"` \| `"bounced"` \| `"complained"` \| `"unsubscribed"` \| `"token-invalid"` \| `"expired"` \| `"failed"`; \}\>[]\>

---

### recordDeliveryEvent()

> **recordDeliveryEvent**(`input`): `Promise`\<`Readonly`\<\{ `duplicate`: `boolean`; `event`: [`EngagementDeliveryEvent`](/api/engagement-core/src/type-aliases/engagementdeliveryevent/); \}\>\>

#### Parameters

##### input

[`RecordEngagementDeliveryEventInput`](/api/engagement-core/src/type-aliases/recordengagementdeliveryeventinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `duplicate`: `boolean`; `event`: [`EngagementDeliveryEvent`](/api/engagement-core/src/type-aliases/engagementdeliveryevent/); \}\>\>
