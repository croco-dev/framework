---
editUrl: false
next: false
prev: false
title: "MembershipCommand"
---

> **MembershipCommand** = \{ `idempotencyKey`: `string`; `maxSeats`: `number` \| `null`; `membershipId`: `string`; `operation`: `"add"`; `role`: [`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/); `tenantId`: `string`; `userId`: `string`; \} \| \{ `idempotencyKey`: `string`; `operation`: `"remove"`; `tenantId`: `string`; `userId`: `string`; \} \| \{ `idempotencyKey`: `string`; `operation`: `"update_role"`; `role`: [`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/); `tenantId`: `string`; `userId`: `string`; \} \| \{ `fromUserId`: `string`; `idempotencyKey`: `string`; `operation`: `"transfer_ownership"`; `tenantId`: `string`; `toUserId`: `string`; \}
