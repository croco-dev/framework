---
editUrl: false
next: false
prev: false
title: "createPublicPageOperations"
---

> **createPublicPageOperations**(`options`): `object`

Bind inspection targets and authorization on the server. No URLs or source facts enter through admin input.

## Parameters

### options

`Readonly`\<\{ `authorize`: (`targetId`) => `Promise`\<`boolean`\>; `inspect`: (`targetId`) => `Promise`\<[`PublicPageInspection`](/api/seo-core/src/type-aliases/publicpageinspection/)\>; \}\>

## Returns

`object`

### inspect()

> **inspect**(`targetId`): `Promise`\<`Readonly`\<\{ `diagnostics`: readonly `Readonly`\<\{ `code`: `string`; `field`: `string`; \}\>[]; `publication?`: `"draft"` \| `"published"` \| `"deleted"` \| `"missing"` \| `"private"` \| `"redirect"`; `resourceId?`: `string`; `responseStatus?`: `number`; `revision?`: `string`; `state`: `"partial"` \| `"ready"` \| `"denied"` \| `"unavailable"`; `targetId`: `string`; \}\>\>

#### Parameters

##### targetId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `diagnostics`: readonly `Readonly`\<\{ `code`: `string`; `field`: `string`; \}\>[]; `publication?`: `"draft"` \| `"published"` \| `"deleted"` \| `"missing"` \| `"private"` \| `"redirect"`; `resourceId?`: `string`; `responseStatus?`: `number`; `revision?`: `string`; `state`: `"partial"` \| `"ready"` \| `"denied"` \| `"unavailable"`; `targetId`: `string`; \}\>\>
