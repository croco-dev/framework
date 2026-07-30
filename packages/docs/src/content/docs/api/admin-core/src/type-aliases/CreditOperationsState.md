---
editUrl: false
next: false
prev: false
title: "CreditOperationsState"
---

> **CreditOperationsState** = \{ `accountId?`: `string`; `kind`: `"loading"`; `tenantId`: `string`; \} \| \{ `kind`: `"empty"`; `message?`: `string`; `tenantId`: `string`; \} \| \{ `grantedPermissions`: readonly `string`[]; `kind`: `"permission-denied"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `requiredPermissions`: readonly `string`[]; `tenantId`: `string`; \} \| \{ `kind`: `"problem"`; `partial?`: [`CreditOperationsReadyState`](/api/admin-core/src/type-aliases/creditoperationsreadystate/); `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `tenantId`: `string`; \} \| \{ `actualPosition`: `number`; `expectedPosition`: `number`; `kind`: `"stale"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `snapshot`: [`CreditOperationsSnapshot`](/api/admin-core/src/type-aliases/creditoperationssnapshot/); `tenantId`: `string`; \} \| [`CreditOperationsReadyState`](/api/admin-core/src/type-aliases/creditoperationsreadystate/)
