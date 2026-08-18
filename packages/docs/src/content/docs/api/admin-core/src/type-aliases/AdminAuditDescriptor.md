---
editUrl: false
next: false
prev: false
title: "AdminAuditDescriptor"
---

> **AdminAuditDescriptor** = `object`

## Properties

### actor

> `readonly` **actor**: [`AdminAuditRequirement`](/api/admin-core/src/type-aliases/adminauditrequirement/)

---

### eventName

> `readonly` **eventName**: `string`

---

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `Extract`\<[`AdminAuditRequirement`](/api/admin-core/src/type-aliases/adminauditrequirement/), `"required"` \| `"optional"`\>

---

### metadata?

> `readonly` `optional` **metadata?**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

---

### reason?

> `readonly` `optional` **reason?**: `Extract`\<[`AdminAuditRequirement`](/api/admin-core/src/type-aliases/adminauditrequirement/), `"required"` \| `"optional"`\>

---

### subjectIdField?

> `readonly` `optional` **subjectIdField?**: `string`

---

### subjectType

> `readonly` **subjectType**: `string`
