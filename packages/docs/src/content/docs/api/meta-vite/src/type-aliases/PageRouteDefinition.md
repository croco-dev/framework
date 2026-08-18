---
editUrl: false
next: false
prev: false
title: "PageRouteDefinition"
---

> **PageRouteDefinition** = `object`

Page route definition accepted by defineRoute().

## Properties

### component

> **component**: `React.ComponentType`\<[`RenderRouteComponentProps`](/api/meta-vite/src/type-aliases/renderroutecomponentprops/)\>

---

### componentRef?

> `optional` **componentRef?**: `string`

---

### head?

> `optional` **head?**: () => [`HeadMetadata`](/api/meta-vite/src/type-aliases/headmetadata/)

#### Returns

[`HeadMetadata`](/api/meta-vite/src/type-aliases/headmetadata/)

---

### mode?

> `optional` **mode?**: [`RenderMode`](/api/meta-vite/src/type-aliases/rendermode/)

---

### path

> **path**: `string`

---

### revalidate?

> `optional` **revalidate?**: `number`
