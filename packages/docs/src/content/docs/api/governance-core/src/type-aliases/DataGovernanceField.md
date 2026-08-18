---
editUrl: false
next: false
prev: false
title: "DataGovernanceField"
---

> **DataGovernanceField** = `object`

## Properties

### classifications

> `readonly` **classifications**: [`NonEmptyArray`](/api/governance-core/src/type-aliases/nonemptyarray/)\<[`DataClassificationTag`](/api/governance-core/src/type-aliases/dataclassificationtag/)\>

---

### deleted?

> `readonly` `optional` **deleted?**: `boolean`

---

### description?

> `readonly` `optional` **description?**: `string`

---

### exported?

> `readonly` `optional` **exported?**: `boolean`

---

### id

> `readonly` **id**: `string`

---

### label?

> `readonly` `optional` **label?**: `string`

---

### metadata?

> `readonly` `optional` **metadata?**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

---

### retentionPolicyId?

> `readonly` `optional` **retentionPolicyId?**: `string`

---

### source?

> `readonly` `optional` **source?**: `"croco"` \| `"provider"` \| `"external"` \| `string` & `object`

---

### valueType?

> `readonly` `optional` **valueType?**: [`DataFieldValueType`](/api/governance-core/src/type-aliases/datafieldvaluetype/)
