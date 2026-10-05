---
editUrl: false
next: false
prev: false
title: "PostgresTimelineSource"
---

## Implements

- [`TimelineSource`](/api/admin-core/src/interfaces/timelinesource/)

## Constructors

### Constructor

> **new PostgresTimelineSource**(`options`): `PostgresTimelineSource`

#### Parameters

##### options

[`PostgresTimelineSourceOptions`](/api/admin-ops/src/type-aliases/postgrestimelinesourceoptions/)

#### Returns

`PostgresTimelineSource`

## Properties

### id

> `readonly` **id**: `string`

#### Implementation of

[`TimelineSource`](/api/admin-core/src/interfaces/timelinesource/).[`id`](/api/admin-core/src/interfaces/timelinesource/#id)

## Methods

### read()

> **read**(`request`): `Promise`\<`Readonly`\<\{ `items`: readonly `Readonly`\<\{ `completeness`: `"complete"` \| `"partial"` \| `"delayed"`; `eventId`: `string`; `kind`: `string`; `objectRef?`: `string`; `observedAt`: `string`; `occurredAt`: `string`; `safeProperties`: `Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>\>; `source`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\>[]; `nextCursor?`: `string`; `status`: [`ExplorerSourceStatus`](/api/admin-core/src/type-aliases/explorersourcestatus/); `truncated`: `boolean`; \}\>\>

#### Parameters

##### request

[`TimelineRequest`](/api/admin-core/src/type-aliases/timelinerequest/)

#### Returns

`Promise`\<`Readonly`\<\{ `items`: readonly `Readonly`\<\{ `completeness`: `"complete"` \| `"partial"` \| `"delayed"`; `eventId`: `string`; `kind`: `string`; `objectRef?`: `string`; `observedAt`: `string`; `occurredAt`: `string`; `safeProperties`: `Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>\>; `source`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\>[]; `nextCursor?`: `string`; `status`: [`ExplorerSourceStatus`](/api/admin-core/src/type-aliases/explorersourcestatus/); `truncated`: `boolean`; \}\>\>

#### Implementation of

[`TimelineSource`](/api/admin-core/src/interfaces/timelinesource/).[`read`](/api/admin-core/src/interfaces/timelinesource/#read)

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

#### Implementation of

[`TimelineSource`](/api/admin-core/src/interfaces/timelinesource/).[`resolve`](/api/admin-core/src/interfaces/timelinesource/#resolve)
