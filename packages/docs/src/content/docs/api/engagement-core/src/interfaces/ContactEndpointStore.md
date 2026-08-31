---
editUrl: false
next: false
prev: false
title: "ContactEndpointStore"
---

## Extended by

- [`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/)

## Methods

### getEndpoint()

> **getEndpoint**(`tenantId`, `endpointId`): `Promise`\<[`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/) \| `undefined`\>

#### Parameters

##### tenantId

`string`

##### endpointId

`string`

#### Returns

`Promise`\<[`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/) \| `undefined`\>

---

### invalidateEndpoint()

> **invalidateEndpoint**(`input`): `Promise`\<[`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/)\>

#### Parameters

##### input

[`InvalidateContactEndpointInput`](/api/engagement-core/src/type-aliases/invalidatecontactendpointinput/)

#### Returns

`Promise`\<[`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/)\>

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

---

### saveEndpoint()

> **saveEndpoint**(`input`): `Promise`\<[`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/)\>

#### Parameters

##### input

[`SaveContactEndpointInput`](/api/engagement-core/src/type-aliases/savecontactendpointinput/)

#### Returns

`Promise`\<[`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/)\>
