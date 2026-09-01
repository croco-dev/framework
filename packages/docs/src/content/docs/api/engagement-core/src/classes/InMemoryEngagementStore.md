---
editUrl: false
next: false
prev: false
title: "InMemoryEngagementStore"
---

In-memory reference implementation of every engagement persistence contract.

## Implements

- [`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/)

## Constructors

### Constructor

> **new InMemoryEngagementStore**(`state?`, `clock?`): `InMemoryEngagementStore`

#### Parameters

##### state?

`InMemoryEngagementState` = `...`

##### clock?

() => `Date`

#### Returns

`InMemoryEngagementStore`

## Methods

### findActiveSuppressions()

> **findActiveSuppressions**(`input`): `Promise`\<readonly `Readonly`\<\{ `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `endpointId?`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `expiresAt?`: `Date`; `id`: `string`; `reason`: `string`; `recipientId?`: `string`; `source`: `string`; `tenantId`: `string`; `topic?`: `string`; \}\>[]\>

#### Parameters

##### input

[`EngagementSuppressionLookup`](/api/engagement-core/src/type-aliases/engagementsuppressionlookup/)

#### Returns

`Promise`\<readonly `Readonly`\<\{ `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `endpointId?`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `expiresAt?`: `Date`; `id`: `string`; `reason`: `string`; `recipientId?`: `string`; `source`: `string`; `tenantId`: `string`; `topic?`: `string`; \}\>[]\>

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`findActiveSuppressions`](/api/engagement-core/src/interfaces/engagementpersistence/#findactivesuppressions)

---

### findByIdentity()

> **findByIdentity**(`identity`): `Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/) \| `undefined`\>

#### Parameters

##### identity

[`EngagementDispatchIdentity`](/api/engagement-core/src/type-aliases/engagementdispatchidentity/)

#### Returns

`Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/) \| `undefined`\>

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`findByIdentity`](/api/engagement-core/src/interfaces/engagementpersistence/#findbyidentity)

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

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`getDispatch`](/api/engagement-core/src/interfaces/engagementpersistence/#getdispatch)

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

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`getEndpoint`](/api/engagement-core/src/interfaces/engagementpersistence/#getendpoint)

---

### invalidateEndpoint()

> **invalidateEndpoint**(`input`): `Promise`\<[`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/)\>

#### Parameters

##### input

[`InvalidateContactEndpointInput`](/api/engagement-core/src/type-aliases/invalidatecontactendpointinput/)

#### Returns

`Promise`\<[`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/)\>

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`invalidateEndpoint`](/api/engagement-core/src/interfaces/engagementpersistence/#invalidateendpoint)

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

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`listActiveEndpoints`](/api/engagement-core/src/interfaces/engagementpersistence/#listactiveendpoints)

---

### listByDispatch()

> **listByDispatch**(`tenantId`, `dispatchId`): `Promise`\<readonly `Readonly`\<\{ `dispatchId`: `string`; `endpointId`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `id`: `string`; `occurredAt`: `Date`; `provider`: `string`; `providerEventId`: `string`; `recordedAt`: `Date`; `tenantId`: `string`; `type`: `"failed"` \| `"accepted"` \| `"delivered"` \| `"opened"` \| `"clicked"` \| `"bounced"` \| `"complained"` \| `"unsubscribed"` \| `"token-invalid"` \| `"expired"`; \}\>[]\>

#### Parameters

##### tenantId

`string`

##### dispatchId

`string`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `dispatchId`: `string`; `endpointId`: `string`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `id`: `string`; `occurredAt`: `Date`; `provider`: `string`; `providerEventId`: `string`; `recordedAt`: `Date`; `tenantId`: `string`; `type`: `"failed"` \| `"accepted"` \| `"delivered"` \| `"opened"` \| `"clicked"` \| `"bounced"` \| `"complained"` \| `"unsubscribed"` \| `"token-invalid"` \| `"expired"`; \}\>[]\>

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`listByDispatch`](/api/engagement-core/src/interfaces/engagementpersistence/#listbydispatch)

---

### listByRecipient()

> **listByRecipient**(`tenantId`, `recipientId`, `options`): `Promise`\<`Readonly`\<\{ `items`: readonly [`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/)[]; `nextCursor?`: `Readonly`\<\{ `dispatchId`: `string`; `updatedAt`: `Date`; \}\>; \}\>\>

#### Parameters

##### tenantId

`string`

##### recipientId

`string`

##### options

`Readonly`\<\{ `after?`: `Readonly`\<\{ `dispatchId`: `string`; `updatedAt`: `Date`; \}\>; `limit`: `number`; \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `items`: readonly [`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/)[]; `nextCursor?`: `Readonly`\<\{ `dispatchId`: `string`; `updatedAt`: `Date`; \}\>; \}\>\>

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`listByRecipient`](/api/engagement-core/src/interfaces/engagementpersistence/#listbyrecipient)

---

### recordDeliveryEvent()

> **recordDeliveryEvent**(`input`): `Promise`\<`Readonly`\<\{ `duplicate`: `boolean`; `event`: [`EngagementDeliveryEvent`](/api/engagement-core/src/type-aliases/engagementdeliveryevent/); \}\>\>

#### Parameters

##### input

[`RecordEngagementDeliveryEventInput`](/api/engagement-core/src/type-aliases/recordengagementdeliveryeventinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `duplicate`: `boolean`; `event`: [`EngagementDeliveryEvent`](/api/engagement-core/src/type-aliases/engagementdeliveryevent/); \}\>\>

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`recordDeliveryEvent`](/api/engagement-core/src/interfaces/engagementpersistence/#recorddeliveryevent)

---

### recordDispatch()

> **recordDispatch**(`input`): `Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/)\>

#### Parameters

##### input

[`RecordEngagementDispatchInput`](/api/engagement-core/src/type-aliases/recordengagementdispatchinput/)

#### Returns

`Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/)\>

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`recordDispatch`](/api/engagement-core/src/interfaces/engagementpersistence/#recorddispatch)

---

### reopen()

> **reopen**(): `InMemoryEngagementStore`

Creates a new store object over the same in-memory backing state.

#### Returns

`InMemoryEngagementStore`

---

### resolvePreference()

> **resolvePreference**(`input`): `Promise`\<`Readonly`\<\{ `changedAt`: `Date`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `recipientId?`: `string`; `scope`: [`EngagementPreferenceScope`](/api/engagement-core/src/type-aliases/engagementpreferencescope/); `source`: `string`; `state`: [`EngagementPreferenceState`](/api/engagement-core/src/type-aliases/engagementpreferencestate/); `tenantId`: `string`; `topic`: `string`; \}\> \| `undefined`\>

#### Parameters

##### input

[`EngagementPreferenceLookup`](/api/engagement-core/src/type-aliases/engagementpreferencelookup/)

#### Returns

`Promise`\<`Readonly`\<\{ `changedAt`: `Date`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `recipientId?`: `string`; `scope`: [`EngagementPreferenceScope`](/api/engagement-core/src/type-aliases/engagementpreferencescope/); `source`: `string`; `state`: [`EngagementPreferenceState`](/api/engagement-core/src/type-aliases/engagementpreferencestate/); `tenantId`: `string`; `topic`: `string`; \}\> \| `undefined`\>

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`resolvePreference`](/api/engagement-core/src/interfaces/engagementpersistence/#resolvepreference)

---

### saveEndpoint()

> **saveEndpoint**(`input`): `Promise`\<[`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/)\>

#### Parameters

##### input

[`SaveContactEndpointInput`](/api/engagement-core/src/type-aliases/savecontactendpointinput/)

#### Returns

`Promise`\<[`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/)\>

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`saveEndpoint`](/api/engagement-core/src/interfaces/engagementpersistence/#saveendpoint)

---

### saveSuppression()

> **saveSuppression**(`suppression`): `Promise`\<`void`\>

#### Parameters

##### suppression

[`EngagementSuppression`](/api/engagement-core/src/type-aliases/engagementsuppression/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`saveSuppression`](/api/engagement-core/src/interfaces/engagementpersistence/#savesuppression)

---

### setPreference()

> **setPreference**(`preference`): `Promise`\<`void`\>

#### Parameters

##### preference

[`EngagementPreference`](/api/engagement-core/src/type-aliases/engagementpreference/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`setPreference`](/api/engagement-core/src/interfaces/engagementpersistence/#setpreference)

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

#### Implementation of

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/).[`transaction`](/api/engagement-core/src/interfaces/engagementpersistence/#transaction)
