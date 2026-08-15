---
editUrl: false
next: false
prev: false
title: "MembershipCommandResult"
---

> **MembershipCommandResult** = \{ `membership`: [`Membership`](/api/membership-core/src/type-aliases/membership/); `operation`: `"add"`; `replayed`: `boolean`; \} \| \{ `membership`: [`Membership`](/api/membership-core/src/type-aliases/membership/); `operation`: `"update_role"`; `previousRole`: [`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/); `replayed`: `boolean`; \} \| \{ `membership`: [`Membership`](/api/membership-core/src/type-aliases/membership/); `operation`: `"remove"`; `replayed`: `boolean`; \} \| \{ `fromMembership`: [`Membership`](/api/membership-core/src/type-aliases/membership/); `operation`: `"transfer_ownership"`; `previousToRole`: [`MembershipRole`](/api/membership-core/src/type-aliases/membershiprole/); `replayed`: `boolean`; `toMembership`: [`Membership`](/api/membership-core/src/type-aliases/membership/); \}
