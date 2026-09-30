---
editUrl: false
next: false
prev: false
title: "PushEndpointLifecycle"
---

Application-owned registration and explicit maintenance; never runs from the send path.

## Constructors

### Constructor

> **new PushEndpointLifecycle**(`persistence`): `PushEndpointLifecycle`

#### Parameters

##### persistence

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/)

#### Returns

`PushEndpointLifecycle`

## Methods

### invalidateStale()

> **invalidateStale**(`input`): `Promise`\<readonly [`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/)[]\>

#### Parameters

##### input

`Readonly`\<\{ `app`: `string`; `environment`: `string`; `platform`: `string`; `provider`: `string`; `recipientId`: `string`; `tenantId`: `string`; \}\> & `Readonly`\<\{ `invalidatedAt`: `Date`; `lastSeenBefore`: `Date`; \}\>

#### Returns

`Promise`\<readonly [`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/)[]\>

---

### invalidateTerminal()

> **invalidateTerminal**(`input`): `Promise`\<[`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/)\>

#### Parameters

##### input

`Readonly`\<\{ `app`: `string`; `environment`: `string`; `platform`: `string`; `provider`: `string`; `recipientId`: `string`; `tenantId`: `string`; \}\> & `Readonly`\<\{ `endpointId`: `string`; `expectedVersion`: `number`; `invalidatedAt`: `Date`; \}\>

#### Returns

`Promise`\<[`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/)\>

---

### register()

> **register**(`input`): `Promise`\<`Readonly`\<\{ `endpoint`: [`PushContactEndpoint`](/api/engagement-core/src/type-aliases/pushcontactendpoint/); `status`: `"registered"` \| `"refreshed"` \| `"rotated"`; \}\>\>

#### Parameters

##### input

[`RegisterPushEndpointInput`](/api/engagement-core/src/type-aliases/registerpushendpointinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `endpoint`: [`PushContactEndpoint`](/api/engagement-core/src/type-aliases/pushcontactendpoint/); `status`: `"registered"` \| `"refreshed"` \| `"rotated"`; \}\>\>

---

### rotate()

> **rotate**(`input`): `Promise`\<`Readonly`\<\{ `endpoint`: [`PushContactEndpoint`](/api/engagement-core/src/type-aliases/pushcontactendpoint/); `status`: `"registered"` \| `"refreshed"` \| `"rotated"`; \}\>\>

#### Parameters

##### input

`Readonly`\<\{ `app`: `string`; `environment`: `string`; `platform`: `string`; `provider`: `string`; `recipientId`: `string`; `tenantId`: `string`; \}\> & `Readonly`\<\{ `lastSeenAt`: `Date`; `tokenReference`: `string`; \}\> & `Readonly`\<\{ `expectedVersion`: `number`; `previousEndpointId`: `string`; \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `endpoint`: [`PushContactEndpoint`](/api/engagement-core/src/type-aliases/pushcontactendpoint/); `status`: `"registered"` \| `"refreshed"` \| `"rotated"`; \}\>\>
