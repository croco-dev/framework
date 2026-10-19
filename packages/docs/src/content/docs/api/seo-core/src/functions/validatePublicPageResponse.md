---
editUrl: false
next: false
prev: false
title: "validatePublicPageResponse"
---

> **validatePublicPageResponse**(`target`, `snapshot`, `response`): [`PublicPageInspection`](/api/seo-core/src/type-aliases/publicpageinspection/)

Parse the initial response as HTML; scripts are never executed or fetched.

## Parameters

### target

[`PublicPageInspectionTarget`](/api/seo-core/src/type-aliases/publicpageinspectiontarget/)

### snapshot

[`PublicPageSnapshot`](/api/seo-core/src/type-aliases/publicpagesnapshot/)

### response

`Readonly`\<\{ `headers`: `Headers`; `html`: `string`; `status`: `number`; \}\>

## Returns

[`PublicPageInspection`](/api/seo-core/src/type-aliases/publicpageinspection/)
