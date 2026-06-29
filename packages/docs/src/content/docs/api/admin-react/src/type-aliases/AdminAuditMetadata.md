---
editUrl: false
next: false
prev: false
title: "AdminAuditMetadata"
---

> **AdminAuditMetadata** = `object`

## Properties

### actorId?

> `readonly` `optional` **actorId?**: `string`

***

### eventName

> `readonly` **eventName**: `string`

***

### metadata?

> `readonly` `optional` **metadata?**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

***

### subjectId

> `readonly` **subjectId**: `string`

***

### subjectType

> `readonly` **subjectType**: `"tenant"` \| `"billing-account"` \| `"subscription"` \| `"entitlement"` \| `"meter"` \| `"user"` \| `"impersonation-session"` \| `"permission"`
