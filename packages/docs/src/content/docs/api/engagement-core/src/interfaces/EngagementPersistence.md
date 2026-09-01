---
editUrl: false
next: false
prev: false
title: "EngagementPersistence"
---

## Extends

- [`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/)

## Methods

### findActiveSuppressions()

> **findActiveSuppressions**(`input`): `Promise`\<readonly `Readonly`\<\{ `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `endpointId?`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `expiresAt?`: `Date`; `id`: `string`; `reason`: `string`; `recipientId?`: `string`; `source`: `string`; `tenantId`: `string`; `topic?`: `string`; \}\>[]\>

#### Parameters

##### input

[`EngagementSuppressionLookup`](/api/engagement-core/src/type-aliases/engagementsuppressionlookup/)

#### Returns

`Promise`\<readonly `Readonly`\<\{ `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `endpointId?`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `expiresAt?`: `Date`; `id`: `string`; `reason`: `string`; `recipientId?`: `string`; `source`: `string`; `tenantId`: `string`; `topic?`: `string`; \}\>[]\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`findActiveSuppressions`](/api/engagement-core/src/interfaces/engagementstoretransaction/#findactivesuppressions)

---

### findByIdentity()

> **findByIdentity**(`identity`): `Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/) \| `undefined`\>

#### Parameters

##### identity

[`EngagementDispatchIdentity`](/api/engagement-core/src/type-aliases/engagementdispatchidentity/)

#### Returns

`Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/) \| `undefined`\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`findByIdentity`](/api/engagement-core/src/interfaces/engagementstoretransaction/#findbyidentity)

---

### getDispatch()

> **getDispatch**(`tenantId`, `dispatchId`): `Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/) \| `undefined`\>

#### Parameters

##### tenantId

`string`

##### dispatchId

`string`

#### Returns

`Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/) \| `undefined`\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`getDispatch`](/api/engagement-core/src/interfaces/engagementstoretransaction/#getdispatch)

---

### getEndpoint()

> **getEndpoint**(`tenantId`, `endpointId`): `Promise`\<[`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/) \| `undefined`\>

#### Parameters

##### tenantId

`string`

##### endpointId

`string`

#### Returns

`Promise`\<[`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/) \| `undefined`\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`getEndpoint`](/api/engagement-core/src/interfaces/engagementstoretransaction/#getendpoint)

---

### invalidateEndpoint()

> **invalidateEndpoint**(`input`): `Promise`\<[`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/)\>

#### Parameters

##### input

[`InvalidateContactEndpointInput`](/api/engagement-core/src/type-aliases/invalidatecontactendpointinput/)

#### Returns

`Promise`\<[`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/)\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`invalidateEndpoint`](/api/engagement-core/src/interfaces/engagementstoretransaction/#invalidateendpoint)

---

### listActiveEndpoints()

> **listActiveEndpoints**(`tenantId`, `recipientId`): `Promise`\<readonly [`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/)[]\>

#### Parameters

##### tenantId

`string`

##### recipientId

`string`

#### Returns

`Promise`\<readonly [`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/)[]\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`listActiveEndpoints`](/api/engagement-core/src/interfaces/engagementstoretransaction/#listactiveendpoints)

---

### listByDispatch()

> **listByDispatch**(`tenantId`, `dispatchId`): `Promise`\<readonly `Readonly`\<\{ `dispatchId`: `string`; `endpointId`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `id`: `string`; `occurredAt`: `Date`; `provider`: `string`; `providerEventId`: `string`; `recordedAt`: `Date`; `tenantId`: `string`; `type`: `"accepted"` \| `"delivered"` \| `"opened"` \| `"clicked"` \| `"bounced"` \| `"complained"` \| `"unsubscribed"` \| `"token-invalid"` \| `"expired"` \| `"failed"`; \}\>[]\>

#### Parameters

##### tenantId

`string`

##### dispatchId

`string`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `dispatchId`: `string`; `endpointId`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `id`: `string`; `occurredAt`: `Date`; `provider`: `string`; `providerEventId`: `string`; `recordedAt`: `Date`; `tenantId`: `string`; `type`: `"accepted"` \| `"delivered"` \| `"opened"` \| `"clicked"` \| `"bounced"` \| `"complained"` \| `"unsubscribed"` \| `"token-invalid"` \| `"expired"` \| `"failed"`; \}\>[]\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`listByDispatch`](/api/engagement-core/src/interfaces/engagementstoretransaction/#listbydispatch)

---

### listByRecipient()

> **listByRecipient**(`tenantId`, `recipientId`, `options`): `Promise`\<`Readonly`\<\{ `items`: readonly [`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/)[]; `nextCursor?`: `Readonly`\<\{ `dispatchId`: `string`; `updatedAt`: `Date`; \}\>; \}\>\>

#### Parameters

##### tenantId

`string`

##### recipientId

`string`

##### options

`Readonly`\<\{ `after?`: [`EngagementDispatchHistoryCursor`](/api/engagement-core/src/type-aliases/engagementdispatchhistorycursor/); `limit`: `number`; \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `items`: readonly [`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/)[]; `nextCursor?`: `Readonly`\<\{ `dispatchId`: `string`; `updatedAt`: `Date`; \}\>; \}\>\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`listByRecipient`](/api/engagement-core/src/interfaces/engagementstoretransaction/#listbyrecipient)

---

### recordDeliveryEvent()

> **recordDeliveryEvent**(`input`): `Promise`\<`Readonly`\<\{ `duplicate`: `boolean`; `event`: [`EngagementDeliveryEvent`](/api/engagement-core/src/type-aliases/engagementdeliveryevent/); \}\>\>

#### Parameters

##### input

[`RecordEngagementDeliveryEventInput`](/api/engagement-core/src/type-aliases/recordengagementdeliveryeventinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `duplicate`: `boolean`; `event`: [`EngagementDeliveryEvent`](/api/engagement-core/src/type-aliases/engagementdeliveryevent/); \}\>\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`recordDeliveryEvent`](/api/engagement-core/src/interfaces/engagementstoretransaction/#recorddeliveryevent)

---

### recordDispatch()

> **recordDispatch**(`input`): `Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/)\>

#### Parameters

##### input

[`RecordEngagementDispatchInput`](/api/engagement-core/src/type-aliases/recordengagementdispatchinput/)

#### Returns

`Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/)\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`recordDispatch`](/api/engagement-core/src/interfaces/engagementstoretransaction/#recorddispatch)

---

### resolvePreference()

> **resolvePreference**(`input`): `Promise`\<`Readonly`\<\{ `changedAt`: `Date`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `recipientId?`: `string`; `scope`: [`EngagementPreferenceScope`](/api/engagement-core/src/type-aliases/engagementpreferencescope/); `source`: `string`; `state`: [`EngagementPreferenceState`](/api/engagement-core/src/type-aliases/engagementpreferencestate/); `tenantId`: `string`; `topic`: `string`; \}\> \| `undefined`\>

#### Parameters

##### input

[`EngagementPreferenceLookup`](/api/engagement-core/src/type-aliases/engagementpreferencelookup/)

#### Returns

`Promise`\<`Readonly`\<\{ `changedAt`: `Date`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `recipientId?`: `string`; `scope`: [`EngagementPreferenceScope`](/api/engagement-core/src/type-aliases/engagementpreferencescope/); `source`: `string`; `state`: [`EngagementPreferenceState`](/api/engagement-core/src/type-aliases/engagementpreferencestate/); `tenantId`: `string`; `topic`: `string`; \}\> \| `undefined`\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`resolvePreference`](/api/engagement-core/src/interfaces/engagementstoretransaction/#resolvepreference)

---

### saveEndpoint()

> **saveEndpoint**(`input`): `Promise`\<[`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/)\>

#### Parameters

##### input

[`SaveContactEndpointInput`](/api/engagement-core/src/type-aliases/savecontactendpointinput/)

#### Returns

`Promise`\<[`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/)\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`saveEndpoint`](/api/engagement-core/src/interfaces/engagementstoretransaction/#saveendpoint)

---

### saveSuppression()

> **saveSuppression**(`suppression`): `Promise`\<`void`\>

#### Parameters

##### suppression

[`EngagementSuppression`](/api/engagement-core/src/type-aliases/engagementsuppression/)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`saveSuppression`](/api/engagement-core/src/interfaces/engagementstoretransaction/#savesuppression)

---

### setPreference()

> **setPreference**(`preference`): `Promise`\<`void`\>

#### Parameters

##### preference

[`EngagementPreference`](/api/engagement-core/src/type-aliases/engagementpreference/)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/).[`setPreference`](/api/engagement-core/src/interfaces/engagementstoretransaction/#setpreference)

---

### transaction()

> **transaction**\<`TResult`\>(`operation`): `Promise`\<`TResult`\>

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### operation

(`stores`) => `Promise`\<`TResult`\>

#### Returns

`Promise`\<`TResult`\>
