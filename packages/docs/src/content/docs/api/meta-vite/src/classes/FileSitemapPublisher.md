---
editUrl: false
next: false
prev: false
title: "FileSitemapPublisher"
---

POSIX publication coordinator. Every writer for one site must share this directory.
Optional StorageProvider stores XML; the shared filesystem still owns the atomic pointer.
A crashed lock fails closed and needs operator inspection before removal. No lease expiry.

## Implements

- [`SitemapPublisher`](/api/meta-vite/src/interfaces/sitemappublisher/)

## Constructors

### Constructor

> **new FileSitemapPublisher**(`directory`, `storage?`): `FileSitemapPublisher`

#### Parameters

##### directory

`string`

##### storage?

`Pick`\<[`StorageProvider`](/api/storage-core/src/type-aliases/storageprovider/), `"put"` \| `"get"`\>

#### Returns

`FileSitemapPublisher`

## Methods

### current()

> **current**(): `Promise`\<[`SitemapPublication`](/api/meta-vite/src/type-aliases/sitemappublication/) \| `null`\>

#### Returns

`Promise`\<[`SitemapPublication`](/api/meta-vite/src/type-aliases/sitemappublication/) \| `null`\>

#### Implementation of

[`SitemapPublisher`](/api/meta-vite/src/interfaces/sitemappublisher/).[`current`](/api/meta-vite/src/interfaces/sitemappublisher/#current)

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

#### Implementation of

[`SitemapPublisher`](/api/meta-vite/src/interfaces/sitemappublisher/).[`publish`](/api/meta-vite/src/interfaces/sitemappublisher/#publish)

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

#### Implementation of

[`SitemapPublisher`](/api/meta-vite/src/interfaces/sitemappublisher/).[`read`](/api/meta-vite/src/interfaces/sitemappublisher/#read)
