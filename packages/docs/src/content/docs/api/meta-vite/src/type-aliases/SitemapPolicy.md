---
editUrl: false
next: false
prev: false
title: "SitemapPolicy"
---

> **SitemapPolicy** = `object`

## Properties

### approveUrl

> `readonly` **approveUrl**: (`url`) => `boolean`

Trusted application mapping, including approved public paths and tenant ownership.

#### Parameters

##### url

`URL`

#### Returns

`boolean`

---

### maxBytesPerFile?

> `readonly` `optional` **maxBytesPerFile?**: `number`

---

### maxEntries?

> `readonly` `optional` **maxEntries?**: `number`

---

### maxPages?

> `readonly` `optional` **maxPages?**: `number`

---

### maxUrlsPerFile?

> `readonly` `optional` **maxUrlsPerFile?**: `number`

---

### origin

> `readonly` **origin**: `string`

---

### pageSize?

> `readonly` `optional` **pageSize?**: `number`

---

### queryValues?

> `readonly` `optional` **queryValues?**: `Readonly`\<`Record`\<`string`, readonly `string`[]\>\>

Meaningful query values are explicit; unknown keys/values are rejected, never stripped.

---

### tenantId

> `readonly` **tenantId**: `string`
