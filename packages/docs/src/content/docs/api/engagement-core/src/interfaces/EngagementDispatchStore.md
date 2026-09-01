---
editUrl: false
next: false
prev: false
title: "EngagementDispatchStore"
---

## Extended by

- [`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/)

## Methods

### findByIdentity()

> **findByIdentity**(`identity`): `Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/) \| `undefined`\>

#### Parameters

##### identity

[`EngagementDispatchIdentity`](/api/engagement-core/src/type-aliases/engagementdispatchidentity/)

#### Returns

`Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/) \| `undefined`\>

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

---

### recordDispatch()

> **recordDispatch**(`input`): `Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/)\>

#### Parameters

##### input

[`RecordEngagementDispatchInput`](/api/engagement-core/src/type-aliases/recordengagementdispatchinput/)

#### Returns

`Promise`\<[`EngagementDispatch`](/api/engagement-core/src/type-aliases/engagementdispatch/)\>
