---
editUrl: false
next: false
prev: false
title: "AdminAction"
---

> **AdminAction** = `object`

## Properties

### audit

> `readonly` **audit**: [`AdminAuditDescriptor`](/api/admin-core/src/type-aliases/adminauditdescriptor/)

---

### disabledWhen?

> `readonly` `optional` **disabledWhen?**: `string`

---

### id

> `readonly` **id**: `string`

---

### idempotency?

> `readonly` `optional` **idempotency?**: `Extract`\<[`AdminAuditRequirement`](/api/admin-core/src/type-aliases/adminauditrequirement/), `"required"` \| `"optional"`\> \| `"not-supported"`

---

### kind

> `readonly` **kind**: [`AdminActionKind`](/api/admin-core/src/type-aliases/adminactionkind/)

---

### label

> `readonly` **label**: `string`

---

### metadata?

> `readonly` `optional` **metadata?**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

---

### mutability

> `readonly` **mutability**: [`AdminActionMutability`](/api/admin-core/src/type-aliases/adminactionmutability/)

---

### permissions

> `readonly` **permissions**: [`NonEmptyArray`](/api/admin-core/src/type-aliases/nonemptyarray/)\<[`AdminPermissionRequirement`](/api/admin-core/src/type-aliases/adminpermissionrequirement/)\>

---

### problems

> `readonly` **problems**: [`NonEmptyArray`](/api/admin-core/src/type-aliases/nonemptyarray/)\<[`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/)\>

---

### recovery?

> `readonly` `optional` **recovery?**: [`AdminActionRecoveryDescriptor`](/api/admin-core/src/type-aliases/adminactionrecoverydescriptor/)

---

### target

> `readonly` **target**: [`AdminActionTarget`](/api/admin-core/src/type-aliases/adminactiontarget/)
