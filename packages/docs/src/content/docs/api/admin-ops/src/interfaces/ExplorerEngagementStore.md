---
editUrl: false
next: false
prev: false
title: "ExplorerEngagementStore"
---

## Methods

### getDispatch()

> **getDispatch**(`tenantId`, `dispatchId`): `Promise`\<`Readonly`\<\{ `channel`: `"email"` \| `"push"`; `createdAt`: `Date`; `id`: `string`; `messageId`: `string`; `outcome`: `Readonly`\<\{ `kind`: `"queued"` \| `"suppressed"` \| `"unavailable"` \| `"skipped"` \| `"failed"`; `retryable?`: `boolean`; \}\>; `recipientId`: `string`; `tenantId`: `string`; `updatedAt`: `Date`; \}\> \| `undefined`\>

#### Parameters

##### tenantId

`string`

##### dispatchId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `channel`: `"email"` \| `"push"`; `createdAt`: `Date`; `id`: `string`; `messageId`: `string`; `outcome`: `Readonly`\<\{ `kind`: `"queued"` \| `"suppressed"` \| `"unavailable"` \| `"skipped"` \| `"failed"`; `retryable?`: `boolean`; \}\>; `recipientId`: `string`; `tenantId`: `string`; `updatedAt`: `Date`; \}\> \| `undefined`\>

---

### listByRecipient()

> **listByRecipient**(`tenantId`, `recipientId`, `options`): `Promise`\<`Readonly`\<\{ `items`: readonly `Readonly`\<\{ `channel`: `"email"` \| `"push"`; `createdAt`: `Date`; `id`: `string`; `messageId`: `string`; `outcome`: `Readonly`\<\{ `kind`: `"queued"` \| `"suppressed"` \| `"unavailable"` \| `"skipped"` \| `"failed"`; `retryable?`: `boolean`; \}\>; `recipientId`: `string`; `tenantId`: `string`; `updatedAt`: `Date`; \}\>[]; `nextCursor?`: `Readonly`\<\{ `dispatchId`: `string`; `updatedAt`: `Date`; \}\>; \}\>\>

#### Parameters

##### tenantId

`string`

##### recipientId

`string`

##### options

`Readonly`\<\{ `after?`: `Readonly`\<\{ `dispatchId`: `string`; `updatedAt`: `Date`; \}\>; `limit`: `number`; \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `items`: readonly `Readonly`\<\{ `channel`: `"email"` \| `"push"`; `createdAt`: `Date`; `id`: `string`; `messageId`: `string`; `outcome`: `Readonly`\<\{ `kind`: `"queued"` \| `"suppressed"` \| `"unavailable"` \| `"skipped"` \| `"failed"`; `retryable?`: `boolean`; \}\>; `recipientId`: `string`; `tenantId`: `string`; `updatedAt`: `Date`; \}\>[]; `nextCursor?`: `Readonly`\<\{ `dispatchId`: `string`; `updatedAt`: `Date`; \}\>; \}\>\>
