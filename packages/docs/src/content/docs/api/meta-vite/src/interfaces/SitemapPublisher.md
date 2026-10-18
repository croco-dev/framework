---
editUrl: false
next: false
prev: false
title: "SitemapPublisher"
---

## Methods

### current()

> **current**(): `Promise`\<[`SitemapPublication`](/api/meta-vite/src/type-aliases/sitemappublication/) \| `null`\>

#### Returns

`Promise`\<[`SitemapPublication`](/api/meta-vite/src/type-aliases/sitemappublication/) \| `null`\>

---

### publish()

> **publish**(`generation`, `command`): `Promise`\<[`SitemapPublication`](/api/meta-vite/src/type-aliases/sitemappublication/)\>

#### Parameters

##### generation

[`SitemapGeneration`](/api/meta-vite/src/type-aliases/sitemapgeneration/)

##### command

###### actorId

`string`

###### expectedGenerationId

`string` \| `null`

###### idempotencyKey

`string`

#### Returns

`Promise`\<[`SitemapPublication`](/api/meta-vite/src/type-aliases/sitemappublication/)\>

---

### read()

> **read**(`generationId`, `name`): `Promise`\<`string` \| `null`\>

Read only complete, immutable generation objects.

#### Parameters

##### generationId

`string`

##### name

`string`

#### Returns

`Promise`\<`string` \| `null`\>
