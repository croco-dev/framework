---
editUrl: false
next: false
prev: false
title: "PageRouteIR"
---

> **PageRouteIR** = `object`

Internal page route IR (intermediate representation).
Normalized from PageRouteDefinition by route compiler.

## Properties

### componentRef?

> `optional` **componentRef?**: `string`

***

### head?

> `optional` **head?**: () => [`HeadMetadata`](/api/meta-vite/src/type-aliases/headmetadata/)

#### Returns

[`HeadMetadata`](/api/meta-vite/src/type-aliases/headmetadata/)

***

### mode

> **mode**: [`RenderMode`](/api/meta-vite/src/type-aliases/rendermode/)

***

### path

> **path**: `string`

***

### revalidateMs?

> `optional` **revalidateMs?**: `number`
