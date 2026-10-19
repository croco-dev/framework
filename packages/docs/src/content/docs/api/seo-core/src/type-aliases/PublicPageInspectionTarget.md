---
editUrl: false
next: false
prev: false
title: "PublicPageInspectionTarget"
---

> **PublicPageInspectionTarget** = `Readonly`\<\{ `definition`: [`PublicPageDefinition`](/api/seo-core/src/type-aliases/publicpagedefinition/); `id`: `string`; `requestUrl`: `string`; `respond`: (`request`) => `Promise`\<`Response`\>; \}\>

Construct on the server from a registered site/preview, never from a caller supplied URL.
