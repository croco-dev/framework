---
editUrl: false
next: false
prev: false
title: "MembershipOwnerMutationInput"
---

> **MembershipOwnerMutationInput** = \{ `operation`: `"remove"`; `tenantId`: `string`; `userId`: `string`; \} \| \{ `operation`: `"demote"`; `role`: `Exclude`\<[`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/), `"owner"`\>; `tenantId`: `string`; `userId`: `string`; \}
