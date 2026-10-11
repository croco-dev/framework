---
editUrl: false
next: false
prev: false
title: "TimelineSource"
---

## Properties

### id

> `readonly` **id**: `string`

## Methods

### read()

> **read**(`request`): `Promise`\<`Readonly`\<\{ `items`: readonly `Readonly`\<\{ `completeness`: `"complete"` \| `"partial"` \| `"delayed"`; `eventId`: `string`; `kind`: `string`; `objectRef?`: `string`; `observedAt`: `string`; `occurredAt`: `string`; `safeProperties`: `Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>\>; `source`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\>[]; `nextCursor?`: `string`; `status`: [`ExplorerSourceStatus`](/api/admin-core/src/type-aliases/explorersourcestatus/); `truncated`: `boolean`; \}\>\>

#### Parameters

##### request

[`TimelineRequest`](/api/admin-core/src/type-aliases/timelinerequest/)

#### Returns

`Promise`\<`Readonly`\<\{ `items`: readonly `Readonly`\<\{ `completeness`: `"complete"` \| `"partial"` \| `"delayed"`; `eventId`: `string`; `kind`: `string`; `objectRef?`: `string`; `observedAt`: `string`; `occurredAt`: `string`; `safeProperties`: `Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>\>; `source`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\>[]; `nextCursor?`: `string`; `status`: [`ExplorerSourceStatus`](/api/admin-core/src/type-aliases/explorersourcestatus/); `truncated`: `boolean`; \}\>\>

---

### resolve()

> **resolve**(`scope`, `subject`, `eventId`): `Promise`\<`Readonly`\<\{ `completeness`: `"complete"` \| `"partial"` \| `"delayed"`; `eventId`: `string`; `kind`: `string`; `objectRef?`: `string`; `observedAt`: `string`; `occurredAt`: `string`; `safeProperties`: `Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>\>; `source`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\> \| `undefined`\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### subject

[`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/)

##### eventId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `completeness`: `"complete"` \| `"partial"` \| `"delayed"`; `eventId`: `string`; `kind`: `string`; `objectRef?`: `string`; `observedAt`: `string`; `occurredAt`: `string`; `safeProperties`: `Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>\>; `source`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\> \| `undefined`\>
