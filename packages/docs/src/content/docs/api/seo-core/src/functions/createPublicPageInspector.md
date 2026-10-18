---
editUrl: false
next: false
prev: false
title: "createPublicPageInspector"
---

> **createPublicPageInspector**(`options`): (`targetId`) => `Promise`\<`Readonly`\<\{ `diagnostics`: readonly `Readonly`\<\{ `code`: `string`; `field`: `string`; \}\>[]; `publication?`: `"published"` \| `"draft"` \| `"missing"` \| `"private"` \| `"deleted"` \| `"redirect"`; `resourceId?`: `string`; `responseStatus?`: `number`; `revision?`: `string`; `state`: `"ready"` \| `"partial"` \| `"denied"` \| `"unavailable"`; `targetId`: `string`; \}\>\>

Registered in-process targets avoid crawler DNS, redirect and cross-tenant URL expansion.

## Parameters

### options

`Readonly`\<\{ `authorize`: (`targetId`) => `Promise`\<`boolean`\>; `targets`: readonly [`PublicPageInspectionTarget`](/api/seo-core/src/type-aliases/publicpageinspectiontarget/)[]; \}\>

## Returns

(`targetId`) => `Promise`\<`Readonly`\<\{ `diagnostics`: readonly `Readonly`\<\{ `code`: `string`; `field`: `string`; \}\>[]; `publication?`: `"published"` \| `"draft"` \| `"missing"` \| `"private"` \| `"deleted"` \| `"redirect"`; `resourceId?`: `string`; `responseStatus?`: `number`; `revision?`: `string`; `state`: `"ready"` \| `"partial"` \| `"denied"` \| `"unavailable"`; `targetId`: `string`; \}\>\>
