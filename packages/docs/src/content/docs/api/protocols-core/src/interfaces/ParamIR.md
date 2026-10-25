---
editUrl: false
next: false
prev: false
title: "ParamIR"
---

## Properties

### contractSchema?

> `optional` **contractSchema?**: `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>

---

### index?

> `optional` **index?**: `number`

Original controller method argument position. Optional for compatibility with
pre-existing serialized RouteIR artifacts that only preserve declaration order.

---

### kind

> **kind**: `"path"` \| `"body"` \| `"query"` \| `"header"` \| `"ctx"` \| `"principal"` \| `"user"` \| `"apiKey"`

---

### name

> **name**: `string`

---

### schema

> **schema**: `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\> \| `null`

---

### sourceLocation?

> `optional` **sourceLocation?**: [`RouteContractSourceLocation`](/api/protocols-core/src/type-aliases/routecontractsourcelocation/)
