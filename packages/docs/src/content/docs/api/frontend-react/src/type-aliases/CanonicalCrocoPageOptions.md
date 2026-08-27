---
editUrl: false
next: false
prev: false
title: "CanonicalCrocoPageOptions"
---

> **CanonicalCrocoPageOptions** = `Partial`\<`Pick`\<[`PageRouteDefinition`](/api/meta-vite/src/type-aliases/pageroutedefinition/), `"head"` \| `"path"`\>\> & `object`

Canonical page options aligned with the meta-vite route contract.

## Type Declaration

### mode?

> `optional` **mode?**: [`PageRouteDefinition`](/api/meta-vite/src/type-aliases/pageroutedefinition/)\[`"mode"`\]

Rendering mode for the page route.

### revalidate?

> `optional` **revalidate?**: `never`

### revalidateSeconds?

> `optional` **revalidateSeconds?**: [`PageRouteDefinition`](/api/meta-vite/src/type-aliases/pageroutedefinition/)\[`"revalidate"`\]

ISR revalidation interval in seconds.

### ssr?

> `optional` **ssr?**: `never`
