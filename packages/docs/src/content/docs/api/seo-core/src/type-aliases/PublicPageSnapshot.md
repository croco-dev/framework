---
editUrl: false
next: false
prev: false
title: "PublicPageSnapshot"
---

> **PublicPageSnapshot** = `Readonly`\<\{ `content`: [`PublicPageContent`](/api/seo-core/src/type-aliases/publicpagecontent/); `indexable`: `boolean`; `state`: `"published"`; \}\> \| `Readonly`\<\{ `state`: `"draft"` \| `"missing"`; `status`: `404`; \}\> \| `Readonly`\<\{ `state`: `"private"`; `status`: `401` \| `403` \| `404`; \}\> \| `Readonly`\<\{ `state`: `"deleted"`; `status`: `404` \| `410`; \}\> \| `Readonly`\<\{ `location`: `string`; `state`: `"redirect"`; `status`: `301` \| `302` \| `307` \| `308`; \}\>
