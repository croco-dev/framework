---
editUrl: false
next: false
prev: false
title: "ListenOptions"
---

## Properties

### spaFallback?

> `optional` **spaFallback?**: `boolean`

---

### staticCacheControl?

> `optional` **staticCacheControl?**: `string` \| `false`

Versioned-asset cache policy. Hashed JS/CSS/image responses use this value.
Set to `false` to omit the header. Defaults to `public, max-age=3600`.

---

### staticDir?

> `optional` **staticDir?**: `string`

---

### staticSpaFallbackCacheControl?

> `optional` **staticSpaFallbackCacheControl?**: `string` \| `false`

SPA fallback (`index.html`) cache policy. Always defaults to
`public, max-age=0, must-revalidate` so an asset override never marks the
shell immutable. Set to `false` to omit the header.

---

### staticStreamThresholdBytes?

> `optional` **staticStreamThresholdBytes?**: `number`

Files at or above this byte size stream via `Readable.toWeb` instead of
`readFile` buffering. Defaults to 1 MiB.
