---
editUrl: false
next: false
prev: false
title: "EventCatalogDescriptor"
---

> **EventCatalogDescriptor** = `object`

## Properties

### description

> `readonly` **description**: `string`

---

### name

> `readonly` **name**: `string`

---

### occurrence

> `readonly` **occurrence**: `"intent"` \| `"committed"` \| `"client-observed"`

---

### owner

> `readonly` **owner**: `string`

---

### propertyDescriptions

> `readonly` **propertyDescriptions**: `Readonly`\<`Record`\<`string`, `string`\>\>

---

### schema

> `readonly` **schema**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

---

### scope

> `readonly` **scope**: `"app"` \| `"tenant"`

---

### sourceLocation

> `readonly` **sourceLocation**: `string`

---

### subjectKind

> `readonly` **subjectKind**: `"user"` \| `"tenant"` \| `"anonymous"`

---

### version

> `readonly` **version**: `number`
