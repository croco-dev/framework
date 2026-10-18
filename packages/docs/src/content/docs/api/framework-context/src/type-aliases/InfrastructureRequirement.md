---
editUrl: false
next: false
prev: false
title: "InfrastructureRequirement"
---

> **InfrastructureRequirement** = `object`

Runtime-neutral requirements; secretRef contains a locator, never a credential.

## Properties

### capabilities

> `readonly` **capabilities**: readonly [`InfrastructureCapability`](/api/framework-context/src/type-aliases/infrastructurecapability/)[]

---

### id

> `readonly` **id**: `string`

---

### kind

> `readonly` **kind**: `"database"` \| `"queue"` \| `"storage"` \| `"secret"`

---

### optional?

> `readonly` `optional` **optional?**: `boolean`

---

### owner

> `readonly` **owner**: `string`

---

### scope

> `readonly` **scope**: `string`

---

### secretRef?

> `readonly` `optional` **secretRef?**: `string`
