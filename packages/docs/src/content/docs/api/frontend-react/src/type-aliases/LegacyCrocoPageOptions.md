---
editUrl: false
next: false
prev: false
title: "LegacyCrocoPageOptions"
---

> **LegacyCrocoPageOptions** = `Partial`\<`Pick`\<[`PageRouteDefinition`](/api/meta-vite/src/type-aliases/pageroutedefinition/), `"head"` \| `"path"`\>\> & `object`

Deprecated page options retained for migration to the canonical route contract.

## Type Declaration

### mode?

> `optional` **mode?**: `never`

### ~~revalidate?~~

> `optional` **revalidate?**: `number`

:::caution[Deprecated]
This value is milliseconds. Use `revalidateSeconds` instead.
:::

### revalidateSeconds?

> `optional` **revalidateSeconds?**: `never`

### ~~ssr?~~

> `optional` **ssr?**: `boolean`

:::caution[Deprecated]
Use `mode: "ssr"` or `mode: "ssg"`.
:::
