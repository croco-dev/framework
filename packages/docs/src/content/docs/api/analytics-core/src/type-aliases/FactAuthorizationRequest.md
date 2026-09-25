---
editUrl: false
next: false
prev: false
title: "FactAuthorizationRequest"
---

> **FactAuthorizationRequest** = `object`

## Properties

### action

> `readonly` **action**: `"read"` \| `"write"` \| `"correct"` \| `"delete"`

---

### actor?

> `readonly` `optional` **actor?**: `string`

---

### definitionId?

> `readonly` `optional` **definitionId?**: `string`

---

### scope

> `readonly` **scope**: [`FactScope`](/api/analytics-core/src/type-aliases/factscope/)

---

### subject

> `readonly` **subject**: [`FactSubject`](/api/analytics-core/src/type-aliases/factsubject/)
