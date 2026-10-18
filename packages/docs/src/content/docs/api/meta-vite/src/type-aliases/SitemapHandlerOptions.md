---
editUrl: false
next: false
prev: false
title: "SitemapHandlerOptions"
---

> **SitemapHandlerOptions** = `object`

## Properties

### authorize

> `readonly` **authorize**: (`request`) => `Promise`\<[`SitemapAccess`](/api/meta-vite/src/type-aliases/sitemapaccess/) \| `null`\>

Authenticate from server-owned session/authorization data. Never trust request actor fields.

#### Parameters

##### request

`Request`

#### Returns

`Promise`\<[`SitemapAccess`](/api/meta-vite/src/type-aliases/sitemapaccess/) \| `null`\>

---

### policy

> `readonly` **policy**: [`SitemapPolicy`](/api/meta-vite/src/type-aliases/sitemappolicy/)

---

### publisher

> `readonly` **publisher**: [`SitemapPublisher`](/api/meta-vite/src/interfaces/sitemappublisher/)

---

### source

> `readonly` **source**: [`SitemapSource`](/api/meta-vite/src/interfaces/sitemapsource/)
