---
editUrl: false
next: false
prev: false
title: "ContractMeterDescriptor"
---

> **ContractMeterDescriptor** = `object`

## Properties

### aggregation

> `readonly` **aggregation**: `"COUNT"` \| `"SUM"`

---

### billing

> `readonly` **billing**: `"local"` \| `"required"`

---

### dimensions?

> `readonly` `optional` **dimensions?**: `Readonly`\<`Record`\<`string`, \{ `kind`: `"enum"`; `values`: readonly (`string` \| `number` \| `boolean`)[]; \}\>\>

---

### key

> `readonly` **key**: `string`

---

### unit

> `readonly` **unit**: `string`
