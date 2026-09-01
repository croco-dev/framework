---
editUrl: false
next: false
prev: false
title: "EngagementStoreTransaction"
---

## Extends

- [`ContactEndpointStore`](/api/engagement-core/src/interfaces/contactendpointstore/).[`EngagementPreferenceStore`](/api/engagement-core/src/interfaces/engagementpreferencestore/).[`SuppressionStore`](/api/engagement-core/src/interfaces/suppressionstore/).[`EngagementDispatchStore`](/api/engagement-core/src/interfaces/engagementdispatchstore/).[`EngagementDeliveryEventStore`](/api/engagement-core/src/interfaces/engagementdeliveryeventstore/)

## Extended by

- [`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/)

## Methods

### findActiveSuppressions()

> **findActiveSuppressions**(`input`): `Promise`\<readonly `Readonly`\<\{ `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `endpointId?`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `expiresAt?`: `Date`; `id`: `string`; `reason`: `string`; `recipientId?`: `string`; `source`: `string`; `tenantId`: `string`; `topic?`: `string`; \}\>[]\>

#### Parameters

##### input

[`EngagementSuppressionLookup`](/api/engagement-core/src/type-aliases/engagementsuppressionlookup/)

#### Returns

`Promise`\<readonly `Readonly`\<\{ `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `endpointId?`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `expiresAt?`: `Date`; `id`: `string`; `reason`: `string`; `recipientId?`: `string`; `source`: `string`; `tenantId`: `string`; `topic?`: `string`; \}\>[]\>

#### Inherited from

[`SuppressionStore`](/api/engagement-core/src/interfaces/suppressionstore/).[`findActiveSuppressions`](/api/engagement-core/src/interfaces/suppressionstore/#findactivesuppressions)

---

### findByIdentity()

> **findByIdentity**(`identity`): `Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/) \| `undefined`\>

#### Parameters

##### identity

[`EngagementDispatchIdentity`](/api/engagement-core/src/type-aliases/engagementdispatchidentity/)

#### Returns

`Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/) \| `undefined`\>

#### Inherited from

[`EngagementDispatchStore`](/api/engagement-core/src/interfaces/engagementdispatchstore/).[`findByIdentity`](/api/engagement-core/src/interfaces/engagementdispatchstore/#findbyidentity)

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

[`EngagementDispatchStore`](/api/engagement-core/src/interfaces/engagementdispatchstore/).[`getDispatch`](/api/engagement-core/src/interfaces/engagementdispatchstore/#getdispatch)

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

[`ContactEndpointStore`](/api/engagement-core/src/interfaces/contactendpointstore/).[`getEndpoint`](/api/engagement-core/src/interfaces/contactendpointstore/#getendpoint)

---

### invalidateEndpoint()

> **invalidateEndpoint**(`input`): `Promise`\<[`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/)\>

#### Parameters

##### input

[`InvalidateContactEndpointInput`](/api/engagement-core/src/type-aliases/invalidatecontactendpointinput/)

#### Returns

`Promise`\<[`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/)\>

#### Inherited from

[`ContactEndpointStore`](/api/engagement-core/src/interfaces/contactendpointstore/).[`invalidateEndpoint`](/api/engagement-core/src/interfaces/contactendpointstore/#invalidateendpoint)

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

[`ContactEndpointStore`](/api/engagement-core/src/interfaces/contactendpointstore/).[`listActiveEndpoints`](/api/engagement-core/src/interfaces/contactendpointstore/#listactiveendpoints)

---

### listByDispatch()

> **listByDispatch**(`tenantId`, `dispatchId`): `Promise`\<readonly `Readonly`\<\{ `dispatchId`: `string`; `endpointId`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `id`: `string`; `occurredAt`: `Date`; `provider`: `string`; `providerEventId`: `string`; `recordedAt`: `Date`; `tenantId`: `string`; `type`: `"accepted"` \| `"expired"` \| `"delivered"` \| `"failed"` \| `"opened"` \| `"clicked"` \| `"bounced"` \| `"complained"` \| `"unsubscribed"` \| `"token-invalid"`; \}\>[]\>

#### Parameters

##### tenantId

`string`

##### dispatchId

`string`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `dispatchId`: `string`; `endpointId`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `id`: `string`; `occurredAt`: `Date`; `provider`: `string`; `providerEventId`: `string`; `recordedAt`: `Date`; `tenantId`: `string`; `type`: `"accepted"` \| `"expired"` \| `"delivered"` \| `"failed"` \| `"opened"` \| `"clicked"` \| `"bounced"` \| `"complained"` \| `"unsubscribed"` \| `"token-invalid"`; \}\>[]\>

#### Inherited from

[`EngagementDeliveryEventStore`](/api/engagement-core/src/interfaces/engagementdeliveryeventstore/).[`listByDispatch`](/api/engagement-core/src/interfaces/engagementdeliveryeventstore/#listbydispatch)

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

[`EngagementDispatchStore`](/api/engagement-core/src/interfaces/engagementdispatchstore/).[`listByRecipient`](/api/engagement-core/src/interfaces/engagementdispatchstore/#listbyrecipient)

---

### recordDeliveryEvent()

> **recordDeliveryEvent**(`input`): `Promise`\<`Readonly`\<\{ `duplicate`: `boolean`; `event`: [`EngagementDeliveryEvent`](/api/engagement-core/src/type-aliases/engagementdeliveryevent/); \}\>\>

#### Parameters

##### input

[`RecordEngagementDeliveryEventInput`](/api/engagement-core/src/type-aliases/recordengagementdeliveryeventinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `duplicate`: `boolean`; `event`: [`EngagementDeliveryEvent`](/api/engagement-core/src/type-aliases/engagementdeliveryevent/); \}\>\>

#### Inherited from

[`EngagementDeliveryEventStore`](/api/engagement-core/src/interfaces/engagementdeliveryeventstore/).[`recordDeliveryEvent`](/api/engagement-core/src/interfaces/engagementdeliveryeventstore/#recorddeliveryevent)

---

### recordDispatch()

> **recordDispatch**(`input`): `Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/)\>

#### Parameters

##### input

[`RecordEngagementDispatchInput`](/api/engagement-core/src/type-aliases/recordengagementdispatchinput/)

#### Returns

`Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/)\>

#### Inherited from

[`EngagementDispatchStore`](/api/engagement-core/src/interfaces/engagementdispatchstore/).[`recordDispatch`](/api/engagement-core/src/interfaces/engagementdispatchstore/#recorddispatch)

---

### resolvePreference()

> **resolvePreference**(`input`): `Promise`\<`Readonly`\<\{ `changedAt`: `Date`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `recipientId?`: `string`; `scope`: [`EngagementPreferenceScope`](/api/engagement-core/src/type-aliases/engagementpreferencescope/); `source`: `string`; `state`: [`EngagementPreferenceState`](/api/engagement-core/src/type-aliases/engagementpreferencestate/); `tenantId`: `string`; `topic`: `string`; \}\> \| `undefined`\>

#### Parameters

##### input

[`EngagementPreferenceLookup`](/api/engagement-core/src/type-aliases/engagementpreferencelookup/)

#### Returns

`Promise`\<`Readonly`\<\{ `changedAt`: `Date`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `recipientId?`: `string`; `scope`: [`EngagementPreferenceScope`](/api/engagement-core/src/type-aliases/engagementpreferencescope/); `source`: `string`; `state`: [`EngagementPreferenceState`](/api/engagement-core/src/type-aliases/engagementpreferencestate/); `tenantId`: `string`; `topic`: `string`; \}\> \| `undefined`\>

#### Inherited from

[`EngagementPreferenceStore`](/api/engagement-core/src/interfaces/engagementpreferencestore/).[`resolvePreference`](/api/engagement-core/src/interfaces/engagementpreferencestore/#resolvepreference)

---

### saveEndpoint()

> **saveEndpoint**(`input`): `Promise`\<[`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/)\>

#### Parameters

##### input

[`SaveContactEndpointInput`](/api/engagement-core/src/type-aliases/savecontactendpointinput/)

#### Returns

`Promise`\<[`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/)\>

#### Inherited from

[`ContactEndpointStore`](/api/engagement-core/src/interfaces/contactendpointstore/).[`saveEndpoint`](/api/engagement-core/src/interfaces/contactendpointstore/#saveendpoint)

---

### saveSuppression()

> **saveSuppression**(`suppression`): `Promise`\<`void`\>

#### Parameters

##### suppression

[`EngagementSuppression`](/api/engagement-core/src/type-aliases/engagementsuppression/)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`SuppressionStore`](/api/engagement-core/src/interfaces/suppressionstore/).[`saveSuppression`](/api/engagement-core/src/interfaces/suppressionstore/#savesuppression)

---

### setPreference()

> **setPreference**(`preference`): `Promise`\<`void`\>

#### Parameters

##### preference

[`EngagementPreference`](/api/engagement-core/src/type-aliases/engagementpreference/)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`EngagementPreferenceStore`](/api/engagement-core/src/interfaces/engagementpreferencestore/).[`setPreference`](/api/engagement-core/src/interfaces/engagementpreferencestore/#setpreference)
