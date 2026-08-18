---
editUrl: false
next: false
prev: false
title: "DataGovernanceAuditDescriptor"
---

> **DataGovernanceAuditDescriptor** = `object`

## Properties

### actor

> `readonly` **actor**: `DataGovernanceAuditRequirement`

---

### eventName

> `readonly` **eventName**: `string`

---

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `Extract`\<`DataGovernanceAuditRequirement`, `"required"` \| `"optional"`\>

---

### metadata?

> `readonly` `optional` **metadata?**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

---

### reason?

> `readonly` `optional` **reason?**: `Extract`\<`DataGovernanceAuditRequirement`, `"required"` \| `"optional"`\>

---

### subjectType

> `readonly` **subjectType**: `string`
