---
editUrl: false
next: false
prev: false
title: "MembershipOwnershipTransferResult"
---

> **MembershipOwnershipTransferResult** = \{ `fromMembership`: [`Membership`](/api/membership-core/src/type-aliases/membership/); `previousToRole`: [`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/); `status`: `"applied"`; `toMembership`: [`Membership`](/api/membership-core/src/type-aliases/membership/); \} \| \{ `status`: `"not_found"`; `userId`: `string`; \} \| \{ `status`: `"source_not_owner"`; \} \| \{ `status`: `"conflict"`; \}
