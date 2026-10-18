---
editUrl: false
next: false
prev: false
title: "SitemapSource"
---

The repository must retain this immutable snapshot throughout cursor iteration.

## Methods

### open()

> **open**(): `Promise`\<\{ `revision`: `string`; `tenantId`: `string`; \}\>

#### Returns

`Promise`\<\{ `revision`: `string`; `tenantId`: `string`; \}\>

---

### read()

> **read**(`input`): `Promise`\<\{ `complete`: `boolean`; `entries`: readonly [`SitemapEntry`](/api/meta-vite/src/type-aliases/sitemapentry/)[]; `nextCursor`: `string` \| `null`; `revision`: `string`; \}\>

#### Parameters

##### input

###### cursor

`string` \| `null`

###### limit

`number`

###### revision

`string`

#### Returns

`Promise`\<\{ `complete`: `boolean`; `entries`: readonly [`SitemapEntry`](/api/meta-vite/src/type-aliases/sitemapentry/)[]; `nextCursor`: `string` \| `null`; `revision`: `string`; \}\>
