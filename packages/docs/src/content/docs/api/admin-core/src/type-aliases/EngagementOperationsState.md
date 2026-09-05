---
editUrl: false
next: false
prev: false
title: "EngagementOperationsState"
---

> **EngagementOperationsState** = \{ `kind`: `"loading"`; `recipientId?`: `string`; `tenantId`: `string`; \} \| \{ `kind`: `"empty"`; `message?`: `string`; `tenantId`: `string`; \} \| \{ `grantedPermissions`: readonly `string`[]; `kind`: `"permission-denied"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `requiredPermissions`: readonly `string`[]; `tenantId`: `string`; \} \| \{ `kind`: `"problem"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `retryable?`: `boolean`; `tenantId`: `string`; \} \| \{ `grantedPermissions`: readonly `string`[]; `kind`: `"ready"`; `snapshot`: [`EngagementOperationsSnapshot`](/api/admin-core/src/type-aliases/engagementoperationssnapshot/); `tenantId`: `string`; \}
