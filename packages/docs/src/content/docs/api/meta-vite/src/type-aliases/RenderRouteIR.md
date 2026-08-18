---
editUrl: false
next: false
prev: false
title: "RenderRouteIR"
---

> **RenderRouteIR** = `object`

Internal render route IR.
Combines page IR with resolved module references for the render core.

## Properties

### componentLoader

> **componentLoader**: () => `Promise`\<\{ `default`: `React.ComponentType`\<[`RenderRouteComponentProps`](/api/meta-vite/src/type-aliases/renderroutecomponentprops/)\>; \}\>

#### Returns

`Promise`\<\{ `default`: `React.ComponentType`\<[`RenderRouteComponentProps`](/api/meta-vite/src/type-aliases/renderroutecomponentprops/)\>; \}\>

---

### head?

> `optional` **head?**: () => [`HeadMetadata`](/api/meta-vite/src/type-aliases/headmetadata/)

#### Returns

[`HeadMetadata`](/api/meta-vite/src/type-aliases/headmetadata/)

---

### mode

> **mode**: [`RenderMode`](/api/meta-vite/src/type-aliases/rendermode/)

---

### path

> **path**: `string`

---

### revalidateMs?

> `optional` **revalidateMs?**: `number`
